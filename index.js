import express from 'express';
import editly from 'editly';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import cors from 'cors';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.json({ status: '✅ Editly API LIVE — FULLY OPTIMIZED (lightweight pre-render, no rawvideo/OOM)' });
});

async function preprocessImageClips(editSpec) {
  if (!editSpec.clips) return { editSpec, tempFiles: [] };
  const tempFiles = [];

  for (const clip of editSpec.clips) {
    if (!clip.layers) continue;
    for (let i = 0; i < clip.layers.length; i++) {
      const layer = clip.layers[i];
      if (layer.type === 'image' && layer.path && layer.path.startsWith('http')) {
        const duration = clip.duration || 5;
        const zoomAmount = Math.max(0, layer.zoomAmount || 0); // safe default
        const tempVideo = `/tmp/${randomUUID()}.mp4`;
        tempFiles.push(tempVideo);

        // OPTIMIZED: ultrafast + 2 threads + bilinear + format fix (5-15s max, no OOM)
        const cmd = `ffmpeg -loop 1 -i "${layer.path}" -t ${duration} \
          -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.002*${zoomAmount*100},1.15)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,format=yuv420p" \
          -c:v libx264 -preset ultrafast -crf 23 -pix_fmt yuv420p -r 30 -threads 2 -y "${tempVideo}"`;

        await execAsync(cmd);

        // Replace with clean video layer (bypasses rawvideo forever)
        clip.layers[i] = { type: 'video', path: tempVideo, resizeMode: 'cover' };
      }
    }
  }
  return { editSpec, tempFiles };
}

app.post('/generate', async (req, res) => {
  console.log('📥 Received editSpec from n8n');

  let tempFiles = [];
  try {
    let { editSpec } = req.body;
    if (!editSpec) return res.status(400).json({ error: 'editSpec required in body' });

    const outFile = `/tmp/${randomUUID()}.mp4`;

    const processed = await preprocessImageClips(editSpec);
    editSpec = processed.editSpec;
    tempFiles = processed.tempFiles;

    const fullSpec = { 
      ...editSpec, 
      outPath: outFile, 
      allowRemoteRequests: true 
    };

    await editly(fullSpec);

    res.download(outFile, 'generated-video.mp4', async (err) => {
      if (!err) await fs.unlink(outFile).catch(() => {});
      for (const f of tempFiles) await fs.unlink(f).catch(() => {});
    });
  } catch (error) {
    console.error('❌ Failed:', error.message);
    for (const f of tempFiles) await fs.unlink(f).catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Editly API running on port ${PORT}`));
