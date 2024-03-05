import GIFEncoder from "gifencoder";
import { createCanvas, Image } from "canvas";

const WIDTH = 1440;
const HEIGHT = 900;

async function createGIF(url, page) {
  const chunks = [];
  let scrolling = true;
  const encoder = new GIFEncoder(WIDTH, HEIGHT);
  const stream = encoder
    .createReadStream()
    .on("data", (chunk) => chunks.push(chunk));

  encoder.start();
  encoder.setFrameRate(60);
  encoder.setQuality(50);
  encoder.setDelay(500);
  encoder.setRepeat(0);

  await page.setViewport({ width: WIDTH, height: HEIGHT });
  await page.goto(url);

  while (scrolling) {
    const screenshot = await page.screenshot({ encoding: "base64" });
    const img = new Image();
    img.src = "data:image/png;base64," + screenshot;
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
    encoder.addFrame(ctx);

    scrolling = await page.evaluate(() => {
      window.scrollBy(0, 75);
      return (
        window.scrollY + window.innerHeight <
        document.documentElement.scrollHeight
      );
    });
  }

  encoder.finish();
  // // Wait for the 'finish' event to ensure all data has been collected
  // await new Promise((resolve) => stream.on("finish", resolve));

  // Convert the data chunks to a Buffer, then to a base64 string
  const gifBuffer = Buffer.concat(chunks);
  const base64Gif = gifBuffer.toString("base64");
  return base64Gif;
}

export default createGIF;
