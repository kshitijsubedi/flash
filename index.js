require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const app = express();

// Use the body-parser Json
app.use(bodyParser.json());

(async () => {
  let browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
    protocolTimeout: 180_000 * 2,
  });

  browser.on("disconnected", async () => {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
      protocolTimeout: 180_000 * 2,
    });
  });
  app.get("/", (req, res) => {
    res.json({ message: "hey!" });
  });

  app.post("/", async (req, res) => {
    // Bring variable outside the try-catch scope so it can be closed at the end
    let page;
    try {
      if (req.headers["content-type"] !== "application/json")
        return res.writeHead(415);
      // Required parameters
      if (!req.body.url) return req.writeHead(400);
      console.log("Received:", req.body.url);

      page = await browser.newPage();
      await page.setJavaScriptEnabled(req.body.enableJavaScript ?? true);
      await page.setViewport({
        width: req.body.screenWidth || 1920,
        height: req.body.screenHeight || 1080,
        deviceScaleFactor: req.body.scale || 1,
      });
      await page.goto(req.body.url);

      // Timeout parameter, end the process early and don't return the image because it's 'taking too long'
      let operationsComplete = false;
      if (req.body.timeout) {
        setTimeout(async () => {
          if (!operationsComplete) {
            await page.close();
            page = null;

            if (res.writable) {
              res.writeHead(408);
            }
            if (!res.closed) {
              res.end();
            }
          }
        }, req.body.timeout);
      }

      if (req.body.waitForNetworkIdle && page) {
        await page.waitForNetworkIdle();
      }

      if (req.body.waitForSelector && page) {
        await page.waitForSelector(req.body.waitForSelector);
      }

      operationsComplete = true;

      if (!page) return "Null";

      let options = {
        encoding: "base64",
        fullPage: !!req.body.full,
        clip: req.body.clip,
        omitBackground: !!req.body.omitBackground,
      };

      if (req.body.quality && req.body.type !== "png") {
        options.quality = req.body.quality;
      }
      await page.waitForTimeout(3000);
      const screenshot = await page.screenshot(options);
      if (res.writable) {
        // res.write(screenshot); //Send the image to the client
        const form = new FormData();
        form.append("key", "315122a73b95ac7b239b81134dff89cb");
        form.append("image", screenshot);

        const response = await fetch("https://api.imgbb.com/1/upload", {
          method: "POST",
          body: form,
        });

        if (!response.ok)
          throw new Error(`Unexpected response ${response.statusText}`);

        const data = await response.json();
        res.json({ url: data.data.url });
      }
    } catch (err) {
      console.error(err);

      if (res.writable) {
        res.writeHead(500);
      }
    } finally {
      res.end();

      if (page) {
        // Close the page as it won't be used anymore, catch the error and do nothing with it
        page.close().catch(() => {});
      }
    }
  });

  app.post("/email", async (req, res) => {
    try {
      let page;
      page = await browser.newPage();
      await page.setJavaScriptEnabled(req.body.enableJavaScript ?? true);
      await page.setViewport({
        width: req.body.screenWidth || 1920,
        height: req.body.screenHeight || 1080,
        deviceScaleFactor: req.body.scale || 1,
      });
      page.setDefaultNavigationTimeout(0);
      await page.goto(req.body.url);
      const html = await page.content();
      const regex = /[a-z0-9\.\-+_]+@[a-z0-9\.\-+_]+\.[a-z]+/g;
      const emails = html.match(regex);
      res.json({ emails: emails });
    } catch (err) {
      console.error(err);
      res.writeHead(500);
      res.end();
    }
  });
})();

app.listen(9898, () => {
  console.log(`app listening on port 9898`);
});

process.on("SIGINT", () => {
  console.log("Ctrl-C was pressed");
  process.exit();
});
