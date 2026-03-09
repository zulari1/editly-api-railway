import express from 'express';
import editly from 'editly';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 8080;

// Friendly health check
app.get('/', (req, res) => {
  res.json({ status: '✅ Editly API LIVE', message: 'Use POST /generate with editSpec' });
});

app.post('/generate', async (req, res) => {
  console.log('📥 Received editSpec from n8n');

  try {
    const { editSpec } = req.body;
    if (!editSpec) return res.status(400).json({ error: 'editSpec required in body' });

    const outFile = `/tmp/${randomUUID()}.mp4`;

    // ← THIS LINE FIXES THE ERROR FOREVER
    const fullSpec = { ...editSpec, outPath: outFile, allowRemoteRequests: true };

    await editly(fullSpec);

    res.download(outFile, 'generated-video.mp4', async (err) => {
      if (!err) await fs.unlink(outFile).catch(() => {});
    });
  } catch (error) {
    console.error('❌ Editly failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Editly API running on port ${PORT}`));
