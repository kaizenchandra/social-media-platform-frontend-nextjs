// Generates original canvas artwork locally. No network content or user uploads.
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext("2d");
    const draw = (frame) => {
      const gradient = context.createLinearGradient(0, 0, 640, 360);
      gradient.addColorStop(0, "#183e45");
      gradient.addColorStop(1, "#376c60");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 640, 360);
      context.fillStyle = "#e4bb7b";
      context.beginPath();
      context.arc(470 + Math.sin(frame / 10) * 12, 95, 40, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#719685";
      context.beginPath();
      context.moveTo(0, 360);
      for (let x = 0; x <= 640; x += 10)
        context.lineTo(x, 235 + Math.sin(x / 110 + frame / 30) * 28);
      context.lineTo(640, 360);
      context.fill();
      context.fillStyle = "#dbece3";
      context.font = "24px sans-serif";
      context.fillText("A moment of quiet", 32, 52);
      context.font = "14px sans-serif";
      context.fillText("COMMON · SYNTHETIC PREVIEW", 32, 327);
    };
    draw(0);
    const stream = canvas.captureStream(12);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8",
      videoBitsPerSecond: 200000,
    });
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.start();
    let frame = 0;
    const timer = setInterval(() => draw(frame++), 1000 / 12);
    await new Promise((resolve) => setTimeout(resolve, 6000));
    recorder.stop();
    await stopped;
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    return [...new Uint8Array(await new Blob(chunks).arrayBuffer())];
  });
  await writeFile(
    new URL("../public/media/synthetic-motion.webm", import.meta.url),
    Buffer.from(bytes),
  );
  process.stdout.write(
    `Generated ${bytes.length} bytes of original synthetic preview video.\n`,
  );
} finally {
  await browser.close();
}
