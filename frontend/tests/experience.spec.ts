import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { demoExperience } from "../src/lib/demo";
import { defaultPresentation } from "../src/lib/presentation";

async function checkNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

async function checkImages(page: Page) {
  for (const image of await page.locator("main img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (element) =>
            (element as HTMLImageElement).complete &&
            (element as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
}

async function mockMicrophone(page: Page, delayedPermission = false) {
  await page.addInitScript((delayed) => {
    const NativeAudioContext = window.AudioContext;
    const updateCount = (name: string) => {
      document.documentElement.dataset[name] = String(
        Number(document.documentElement.dataset[name] || 0) + 1,
      );
    };
    const stream = {
      getTracks: () => [{ stop: () => updateCount("tracksStopped") }],
    };
    class MockAudioContext extends NativeAudioContext {
      microphone = true;
      close() {
        updateCount(this.microphone ? "contextsClosed" : "musicContextsClosed");
        return super.close();
      }
      createGain() {
        this.microphone = false;
        const gain = super.createGain();
        const target = gain.gain.setTargetAtTime.bind(gain.gain);
        gain.gain.setTargetAtTime = (value, startTime, timeConstant) => {
          document.documentElement.dataset.musicGain = String(value);
          return target(value, startTime, timeConstant);
        };
        return gain;
      }
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        const stop = source.stop.bind(source);
        source.start = (
          ...parameters: Parameters<AudioBufferSourceNode["start"]>
        ) => {
          updateCount("musicSourcesStarted");
          const samples = source.buffer!.getChannelData(0);
          let peak = 0;
          let energy = 0;
          for (const value of samples) {
            peak = Math.max(peak, Math.abs(value));
            energy += value * value;
          }
          document.documentElement.dataset.musicPeak = String(peak);
          document.documentElement.dataset.musicRms = String(
            Math.sqrt(energy / samples.length),
          );
          document.documentElement.dataset.musicDuration = String(
            source.buffer!.duration,
          );
          return start(...parameters);
        };
        source.stop = (
          ...parameters: Parameters<AudioBufferSourceNode["stop"]>
        ) => {
          updateCount("musicSourcesStopped");
          return stop(...parameters);
        };
        return source;
      }
      createMediaStreamSource() {
        this.microphone = true;
        return { connect() {} } as unknown as MediaStreamAudioSourceNode;
      }
      createAnalyser() {
        return {
          fftSize: 1024,
          frequencyBinCount: 512,
          smoothingTimeConstant: 0,
          getByteTimeDomainData(buffer: Uint8Array) {
            buffer.fill(
              document.documentElement.dataset.audioSignal === "blow"
                ? 148
                : 128,
            );
          },
          getByteFrequencyData(buffer: Uint8Array) {
            buffer.fill(160);
          },
        } as unknown as AnalyserNode;
      }
    }
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: MockAudioContext,
    });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: () =>
        delayed
          ? new Promise((resolve) =>
              window.addEventListener(
                "grant-test-microphone",
                () => resolve(stream),
                { once: true },
              ),
            )
          : Promise.resolve(stream),
    });
  }, delayedPermission);
}

async function enableMicrophone(page: Page) {
  await page.getByRole("button", { name: /^Blow candles$/i }).click();
}

async function blowCandles(page: Page) {
  await page.evaluate(() => {
    document.documentElement.dataset.audioSignal = "quiet";
  });
  await enableMicrophone(page);
  await expect(
    page.getByText("Make your wish, then gently blow", { exact: false }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.audioSignal = "blow";
  });
  await expect(page.locator(".celebration-gif")).toBeVisible({
    timeout: 15000,
  });
}

async function openLetter(page: Page) {
  await page.getByRole("button", { name: "There's more in my heart" }).click();
  await page.locator(".heart-screen, .memory-screen, .letter-screen").waitFor();
  if (await page.locator(".heart-screen").count()) {
    await page.getByRole("button", { name: "Open our memories" }).click();
  }
  await page.locator(".memory-screen, .letter-screen").waitFor();
  while (
    await page.getByRole("button", { name: "Next memory", exact: true }).count()
  ) {
    await page
      .getByRole("button", { name: "Next memory", exact: true })
      .click();
  }
  if (
    await page
      .getByRole("button", { name: "A letter for you", exact: true })
      .count()
  ) {
    await page
      .getByRole("button", { name: "A letter for you", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Open your letter", exact: true })
    .last()
    .click();
  await expect(
    page.locator(".open-letter .story-text-content"),
  ).not.toBeEmpty();
}

async function checkFixedScreen(page: Page) {
  await expect(
    page.getByRole("button", {
      name: /^(Pause|Resume) animations$/,
      includeHidden: true,
    }),
  ).toHaveCount(0);
  await checkNoOverflow(page);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= innerHeight && scrollY === 0,
    ),
  ).toBe(true);
  const stage = await page.locator(".journey-stage").boundingBox();
  const footer = await page.locator(".journey-footer").boundingBox();
  expect(stage).not.toBeNull();
  expect(footer).not.toBeNull();
  for (const control of await page
    .locator(".journey-stage button:visible")
    .all()) {
    const bounds = await control.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(stage!.y - 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(footer!.y + 2);
  }
  for (const text of await page.locator(".story-text-content:visible").all()) {
    expect(
      await text.evaluate(
        (element) =>
          element.scrollHeight <= element.clientHeight + 1 &&
          element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
  }
}

async function canvasPixels(page: Page) {
  await expect(page.locator('.love-scene[data-renderer="webgl"]')).toBeVisible({
    timeout: 20000,
  });
  return page.locator(".three-mount canvas").evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const sample = document.createElement("canvas");
    sample.width = 80;
    sample.height = 80;
    const context = sample.getContext("2d")!;
    context.drawImage(canvas, 0, 0, 80, 80);
    const pixels = context.getImageData(0, 0, 80, 80).data;
    let visible = 0;
    let checksum = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset + 3] > 30) visible += 1;
      checksum +=
        pixels[offset] + pixels[offset + 1] * 2 + pixels[offset + 2] * 3;
    }
    return { visible, checksum, image: canvas.toDataURL() };
  });
}

test("desktop recipient story, memories, letter, candle, and surprise work", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockMicrophone(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Happy birthday, Sophie." }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".love-journey")).toHaveAttribute(
    "data-chapter",
    "wish",
  );
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.locator(".microphone-button")).toHaveCount(0);
  await page.mouse.wheel(0, 1200);
  await page.keyboard.press("PageDown");
  await checkFixedScreen(page);
  const cakePixels = await canvasPixels(page);
  expect(cakePixels.visible).toBeGreaterThan(400);
  expect(cakePixels.visible).toBeLessThan(5800);
  await page.screenshot({
    path: testInfo.outputPath("cake-desktop.png"),
    animations: "disabled",
  });
  await blowCandles(page);
  await expect(page.locator(".celebration-gif")).toHaveAttribute(
    "src",
    "/animations/flowers-for-you.gif",
  );
  await checkImages(page);
  await checkFixedScreen(page);
  await page.screenshot({
    path: testInfo.outputPath("gif-desktop.png"),
    animations: "disabled",
  });
  await expect(
    page.getByRole("button", { name: "Pause music", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "There's more in my heart" }).click();
  const heartPixels = await canvasPixels(page);
  expect(heartPixels.visible).toBeGreaterThan(300);
  await page.mouse.move(900, 420);
  await expect
    .poll(async () => (await canvasPixels(page)).checksum)
    .not.toBe(heartPixels.checksum);
  await page.screenshot({
    path: testInfo.outputPath("heart-desktop.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Open our memories" }).click();
  await expect(
    page.getByRole("heading", { name: "Where it all began" }),
  ).toBeVisible();
  await checkImages(page);
  await page.getByRole("button", { name: "Next memory", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Our little escape" }),
  ).toBeVisible();
  await checkImages(page);
  await page.getByRole("button", { name: "Next memory", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "On top of the world" }),
  ).toBeVisible();
  await checkImages(page);
  await checkFixedScreen(page);
  await page
    .getByRole("button", { name: "A letter for you", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open your letter", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "My favorite person," }),
  ).toBeVisible();
  let letter = "";
  for (let index = 0; index < 30; index += 1) {
    letter += await page
      .locator(".open-letter .story-text-content")
      .textContent();
    const next = page.getByRole("button", { name: "Next love letter page" });
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click();
  }
  expect(letter).toBe(demoExperience.letterBody);
  await checkFixedScreen(page);
  await page.getByRole("button", { name: "One more little thing" }).click();
  await expect(page.locator(".love-journey")).toHaveAttribute(
    "data-chapter",
    "ending",
  );
  await expect(page.locator(".journey-progress")).toHaveAttribute(
    "aria-label",
    "Always, you, chapter 6 of 6",
  );
  await expect(page.locator(".surprise-present, .present-box")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "I'd still choose you." }),
  ).toBeVisible();
  await expect(page.locator(".ending-gif")).toBeVisible();
  await checkFixedScreen(page);
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(demoExperience.surprise.answer, { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Your response", exact: true })
    .fill("   ");
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeDisabled();
  await page
    .locator(".surprise-response-form")
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await expect(
    page.getByRole("region", { name: "Your surprise result", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Your response", exact: true })
    .fill("The cafe by the station");
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText(demoExperience.surprise.answer, { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Your surprise result", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("textbox", { name: "Your response", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(".surprise-message .story-text-content"),
  ).toContainText("Saturday, 10 am.");
  await expect(
    page.getByRole("button", { name: "A little more forever" }),
  ).toHaveCount(0);
  await expect(page.locator(".ending-message")).toHaveCount(0);
  await expect(
    page.getByText("Here's to more sunsets, more inside jokes, and more us.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText("To all the beautiful days still ahead.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "I'd still choose you." }),
  ).toBeVisible();
  await expect(page.locator(".ending-gif")).toHaveAttribute(
    "src",
    "/animations/forever-hug.gif",
  );
  await checkImages(page);
  await checkFixedScreen(page);
  await page.screenshot({
    path: testInfo.outputPath("ending-desktop.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "One more wish" }).click();
  await expect(page.locator(".love-journey")).toHaveAttribute(
    "data-chapter",
    "wish",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-music-sources-stopped",
    "1",
  );
  await expect(
    page.getByRole("button", { name: "Pause music", exact: true }),
  ).toBeHidden();
  expect(errors).toEqual([]);
});

test("recipient opening has no studio shortcut and a clear candle action", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /^Blow candles$/i }),
  ).toBeVisible();
  await expect(page.locator('a[href="/studio"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Back to editor" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /\d+\s+issues?/i }),
  ).toHaveCount(0);
  await checkFixedScreen(page);
});

test("birthday music stays silent until candles go out and starts at 80 percent", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockMicrophone(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Play music", exact: true }),
  ).toBeHidden();
  expect(
    await page.locator("html").getAttribute("data-music-sources-started"),
  ).toBeNull();
  await enableMicrophone(page);
  await expect(
    page.getByText("Make your wish, then gently blow", { exact: false }),
  ).toBeVisible();
  expect(
    await page.locator("html").getAttribute("data-music-sources-started"),
  ).toBeNull();
  await page.evaluate(() => {
    document.documentElement.dataset.audioSignal = "blow";
  });
  await expect(page.locator(".celebration-gif")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause music", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("slider", { name: "Music volume" })).toBeHidden();
  await page.screenshot({
    path: testInfo.outputPath("collapsed-volume-mobile.png"),
    animations: "disabled",
  });
  await page.getByLabel("Volume controls", { exact: true }).click();
  await expect(page.getByRole("slider", { name: "Music volume" })).toHaveValue(
    "0.8",
  );
  await expect(page.locator("html")).toHaveAttribute("data-music-gain", "0.8");
  await expect(page.locator("html")).toHaveAttribute(
    "data-music-sources-started",
    "1",
  );
  expect(
    Number(await page.locator("html").getAttribute("data-music-peak")),
  ).toBeLessThan(1);
  expect(
    Number(await page.locator("html").getAttribute("data-music-rms")),
  ).toBeGreaterThan(0.02);
  expect(
    Number(await page.locator("html").getAttribute("data-music-duration")),
  ).toBeGreaterThan(15);
  await page.getByRole("button", { name: "Mute music", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-music-gain", "0");
  await expect(
    page.getByRole("button", { name: "Unmute music", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Unmute music", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-music-gain", "0.8");
  await page.getByLabel("Volume controls", { exact: true }).click();
  await expect(page.getByRole("slider", { name: "Music volume" })).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-music-gain", "0.8");
  await page.getByLabel("Volume controls", { exact: true }).press("Enter");
  await expect(
    page.getByRole("slider", { name: "Music volume" }),
  ).toBeVisible();
  await page.getByRole("slider", { name: "Music volume" }).press("ArrowLeft");
  await expect(page.locator("html")).toHaveAttribute("data-music-gain", "0.75");
  await page.getByRole("slider", { name: "Music volume" }).press("ArrowRight");
  await expect(page.locator("html")).toHaveAttribute("data-music-gain", "0.8");
  await page.getByRole("button", { name: "Pause music", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play music", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-music-gain", "0");
  await page.getByRole("button", { name: "Play music", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause music", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-music-sources-started",
    "1",
  );
  await expect(page.getByRole("slider", { name: "Music volume" })).toBeHidden();
});

test("blocked birthday audio offers an explicit play recovery", async ({
  page,
}) => {
  await mockMicrophone(page);
  await page.addInitScript(() => {
    const resume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = function (
      this: AudioContext & { microphone?: boolean },
    ) {
      if (
        !this.microphone &&
        document.documentElement.dataset.audioSignal === "blow" &&
        document.documentElement.dataset.allowBirthdayAudio !== "true"
      ) {
        return Promise.reject(
          new DOMException("Playback needs a gesture", "NotAllowedError"),
        );
      }
      return resume.call(this);
    };
  });
  await page.goto("/");
  await blowCandles(page);
  await expect(
    page.getByText("Tap play to start the birthday music."),
  ).toBeVisible();
  expect(
    await page.locator("html").getAttribute("data-music-sources-started"),
  ).toBeNull();
  await page.evaluate(() => {
    document.documentElement.dataset.allowBirthdayAudio = "true";
  });
  await page.getByRole("button", { name: "Play music", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause music", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-music-gain", "0.8");
});

test("microphone is requested only after consent and denial keeps a fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let calls = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        calls += 1;
        document.documentElement.dataset.microphoneCalls = String(calls);
        throw new DOMException("Permission denied", "NotAllowedError");
      },
    });
  });
  await page.goto("/");
  expect(
    await page.locator("html").getAttribute("data-microphone-calls"),
  ).toBeNull();
  await expect(
    page.getByText("Uses your microphone to catch your breath", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    await page.locator("html").getAttribute("data-microphone-calls"),
  ).toBeNull();
  await enableMicrophone(page);
  await expect(
    page.getByText("Microphone access is off.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-microphone-calls",
    "1",
  );
  await expect(page.locator(".love-journey")).toHaveAttribute(
    "data-chapter",
    "wish",
  );
  await page
    .getByRole("button", {
      name: "Make a wish without a microphone",
      exact: true,
    })
    .click();
  await expect(page.locator(".celebration-gif")).toBeVisible();
});

test("unsupported microphone has a working manual alternative", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    }),
  );
  await page.goto("/");
  await enableMicrophone(page);
  await expect(
    page.getByText("Your microphone isn't available here.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Make a wish without a microphone",
      exact: true,
    })
    .click();
  await expect(page.locator(".celebration-gif")).toBeVisible();
});

test("sustained microphone input extinguishes the candle and releases resources", async ({
  page,
}) => {
  await mockMicrophone(page);
  await page.goto("/");
  await expect(page.locator(".microphone-button")).toHaveCount(0);
  await enableMicrophone(page);
  await expect(
    page.getByText("Make your wish, then gently blow", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "rose birthday cake with 3 lit candles",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".love-journey")).toHaveAttribute(
    "data-chapter",
    "wish",
  );
  await page.evaluate(() => {
    document.documentElement.dataset.audioSignal = "blow";
  });
  await expect(page.locator(".celebration-gif")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-tracks-stopped",
    "1",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-contexts-closed",
    "1",
  );
});

test("canceling or hiding the experience stops microphone resources", async ({
  page,
}) => {
  await mockMicrophone(page);
  await page.goto("/");
  await enableMicrophone(page);
  await expect(
    page.getByRole("meter", { name: "Microphone level" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel listening" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-tracks-stopped",
    "1",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-contexts-closed",
    "1",
  );
  await enableMicrophone(page);
  await expect(
    page.getByText("Make your wish, then gently blow", { exact: false }),
  ).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("html")).toHaveAttribute(
    "data-tracks-stopped",
    "2",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-contexts-closed",
    "2",
  );
});

test("microphone timeout releases resources and offers another try", async ({
  page,
}) => {
  await mockMicrophone(page);
  await page.clock.install();
  await page.goto("/");
  await enableMicrophone(page);
  await expect(
    page.getByRole("meter", { name: "Microphone level" }),
  ).toBeVisible();
  await page.clock.fastForward(15000);
  await expect(
    page.getByText("We couldn't quite catch that.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-tracks-stopped",
    "1",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-contexts-closed",
    "1",
  );
  await expect(
    page.getByRole("button", { name: /^Blow candles$/i }),
  ).toBeEnabled();
});

test("late microphone permission after cancellation cannot retain a stream", async ({
  page,
}) => {
  await mockMicrophone(page, true);
  await page.goto("/");
  await enableMicrophone(page);
  await expect(
    page.getByText("Waiting for microphone permission..."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel listening" }).click();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("grant-test-microphone")),
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-tracks-stopped",
    "1",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-contexts-closed",
    "1",
  );
  await expect(
    page.getByRole("img", {
      name: "rose birthday cake with 3 lit candles",
      exact: true,
    }),
  ).toBeVisible();
});

test("mobile chapters and reduced motion remain accessible without scrolling", async ({
  page,
}, testInfo) => {
  await mockMicrophone(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await checkFixedScreen(page);
  const staticCake = await canvasPixels(page);
  expect(staticCake.visible).toBeGreaterThan(400);
  expect((await canvasPixels(page)).checksum).toBe(staticCake.checksum);
  await page.screenshot({
    path: testInfo.outputPath("cake-mobile.png"),
    animations: "disabled",
  });
  await blowCandles(page);
  await expect(page.locator(".celebration-gif")).toHaveAttribute(
    "src",
    "/animations/flowers-for-you-still.webp",
  );
  await expect(
    page.getByRole("heading", { name: "All this love. Just for you." }),
  ).toBeFocused();
  await checkImages(page);
  await checkFixedScreen(page);
  await page.screenshot({
    path: testInfo.outputPath("gif-mobile.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "There's more in my heart" }).click();
  const staticHeart = await canvasPixels(page);
  expect(staticHeart.visible).toBeGreaterThan(300);
  await checkFixedScreen(page);
  await page.screenshot({
    path: testInfo.outputPath("heart-mobile.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Open our memories" }).click();
  await checkImages(page);
  await checkFixedScreen(page);
  await page.screenshot({
    path: testInfo.outputPath("memory-mobile.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Next memory", exact: true }).click();
  await page.getByRole("button", { name: "Next memory", exact: true }).click();
  await page
    .getByRole("button", { name: "A letter for you", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open your letter", exact: true })
    .last()
    .click();
  await expect(
    page.locator(".open-letter .story-text-content"),
  ).not.toBeEmpty();
  await checkFixedScreen(page);
  await page.screenshot({
    path: testInfo.outputPath("letter-mobile.png"),
    animations: "disabled",
  });
  let letter = "";
  for (let index = 0; index < 40; index += 1) {
    letter += await page
      .locator(".open-letter .story-text-content")
      .textContent();
    const next = page.getByRole("button", { name: "Next love letter page" });
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click();
  }
  expect(letter).toBe(demoExperience.letterBody);
  await page.getByRole("button", { name: "One more little thing" }).click();
  await expect(page.locator(".ending-screen")).toBeVisible();
  await checkFixedScreen(page);
  await page
    .getByRole("textbox", { name: "Your response", exact: true })
    .fill("Our first coffee together");
  await page
    .getByRole("textbox", { name: "Your response", exact: true })
    .press("Enter");
  await expect(
    page.locator(".surprise-message .story-text-content"),
  ).toHaveText(demoExperience.surprise.answer);
  await checkFixedScreen(page);
  await expect(page.locator(".ending-screen")).toBeVisible();
  await expect(page.locator(".ending-gif")).toHaveAttribute(
    "src",
    "/animations/forever-hug-still.webp",
  );
  await checkImages(page);
  await checkFixedScreen(page);
  await page.screenshot({
    path: testInfo.outputPath("ending-mobile.png"),
    animations: "disabled",
  });
});

test("320px and wide desktop layouts do not overflow", async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 768, height: 900 },
    { width: 1920, height: 1080 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await checkFixedScreen(page);
    const stage = await page.locator(".birthday-stage").boundingBox();
    expect(stage!.height).toBeGreaterThan(100);
    expect(stage!.width).toBeGreaterThan(200);
  }
});

test("animated phone canvas moves without animation controls", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const initial = await canvasPixels(page);
  expect(initial.visible).toBeGreaterThan(400);
  await expect
    .poll(async () => (await canvasPixels(page)).checksum)
    .not.toBe(initial.checksum);
  await checkFixedScreen(page);
  await page.screenshot({
    path: testInfo.outputPath("animated-cake-mobile.png"),
    animations: "disabled",
  });
});

test("image optimization rejects private media URLs", async ({ request }) => {
  const assetPath = "/api/media/00000000-0000-4000-8000-000000000001/";
  for (const source of [
    assetPath,
    `${assetPath}still/`,
    `${assetPath}?share=test-token`,
    `${assetPath}still/?share=test-token`,
  ]) {
    const query = new URLSearchParams({ url: source, w: "640", q: "75" });
    const response = await request.get(`/_next/image?${query}`);
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain('"url" parameter is not allowed');
  }
});

test("unknown private links provide a recovery state", async ({ page }) => {
  await page.goto("/experience/unknown-link-for-test");
  await expect(
    page.getByRole("heading", { name: "A little story, out of reach." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Visit Ever, after" }),
  ).toHaveAttribute("href", "/");
});

test("no-WebGL devices retain the cake and complete microphone fallback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const originalContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (
        type === "webgl" ||
        type === "webgl2" ||
        type === "experimental-webgl"
      )
        return null;
      return Reflect.apply(originalContext, this, [type, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto("/");
  await expect(
    page.locator('.love-scene[data-renderer="fallback"]'),
  ).toBeVisible();
  await expect(page.locator(".cake")).toBeVisible();
  await expect(page.locator(".flame")).toHaveCount(3);
  await checkFixedScreen(page);
  await enableMicrophone(page);
  await page
    .getByRole("button", {
      name: "Make a wish without a microphone",
      exact: true,
    })
    .click();
  await expect(page.locator(".celebration-gif")).toBeVisible();
  await page.getByRole("button", { name: "There's more in my heart" }).click();
  await expect(page.locator(".heart-fallback")).toBeVisible();
  await page.getByRole("button", { name: "Open our memories" }).click();
  await expect(page.locator(".memory-screen")).toBeVisible();
});

test("merged finale fits a small phone with or without a surprise", async ({
  page,
}, testInfo) => {
  await mockMicrophone(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 568 });
  for (const enabled of [true, false]) {
    const token = `merged-finale-${enabled}`;
    await page.route(`**/api/shared/${token}/`, (route) =>
      route.fulfill({
        json: {
          ...demoExperience,
          memories: [],
          surprise: { ...demoExperience.surprise, enabled },
        },
      }),
    );
    await page.goto(`/experience/${token}`);
    await blowCandles(page);
    await openLetter(page);
    await page
      .getByRole("button", {
        name: "One more little thing",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "I'd still choose you." }),
    ).toBeVisible();
    await expect(page.locator(".journey-progress")).toHaveAttribute(
      "aria-label",
      "Always, you, chapter 5 of 5",
    );
    await expect(page.locator(".present-box, .surprise-present")).toHaveCount(
      0,
    );
    await expect(page.locator(".ending-gif")).toBeVisible();
    await checkImages(page);
    await checkFixedScreen(page);
    if (enabled) {
      await page
        .getByRole("textbox", { name: "Your response", exact: true })
        .fill("A day to remember");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await checkFixedScreen(page);
      await expect(page.locator(".love-journey")).toHaveAttribute(
        "data-chapter",
        "ending",
      );
    } else {
      await expect(
        page.getByRole("button", { name: "Send", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("textbox", { name: "Your response", exact: true }),
      ).toHaveCount(0);
    }
    await page.screenshot({
      path: testInfo.outputPath(`merged-finale-${enabled}.png`),
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Previous chapter" }).click();
    await expect(page.locator(".letter-screen")).toBeVisible();
  }
});

test("surprise requires a submitted response and clears it on replay", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    }),
  );
  const presentation = defaultPresentation();
  presentation.chapters = {
    celebration: false,
    heart: false,
    memories: false,
    letter: false,
  };
  presentation.musicEnabled = false;
  presentation.copy.surpriseButton = "Tell me everything";
  await page.route("**/api/shared/reply-test/", (route) =>
    route.fulfill({
      json: {
        ...demoExperience,
        closingMessage: "With love, from your person.",
        presentation,
      },
    }),
  );
  await page.goto("/experience/reply-test");
  await enableMicrophone(page);
  await page
    .getByRole("button", {
      name: "Make a wish without a microphone",
      exact: true,
    })
    .click();
  const response = page.getByRole("textbox", {
    name: "Your response",
    exact: true,
  });
  const send = page.getByRole("button", { name: "Send", exact: true });
  await expect(response).toBeVisible();
  await expect(send).toBeDisabled();
  await response.fill("   ");
  await page
    .locator(".surprise-response-form")
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await expect(
    page.getByRole("region", { name: "Your surprise result", exact: true }),
  ).toHaveCount(0);
  await response.fill("A little reply for you");
  await expect(send).toBeEnabled();
  await expect(
    page.getByText(demoExperience.surprise.answer, { exact: true }),
  ).toHaveCount(0);
  await checkFixedScreen(page);
  await page.screenshot({
    path: testInfo.outputPath("reply-mobile.png"),
    animations: "disabled",
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await checkFixedScreen(page);
  const submittedRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") submittedRequests.push(request.url());
  });
  await response.press("Enter");
  await expect(
    page.getByRole("region", { name: "Your surprise result", exact: true }),
  ).toBeFocused();
  await expect(response).toHaveCount(0);
  await expect(
    page.locator(".surprise-message .story-text-content"),
  ).not.toBeEmpty();
  expect(submittedRequests).toEqual([]);
  await page
    .getByRole("button", { name: "One more wish", exact: true })
    .click();
  await enableMicrophone(page);
  await page
    .getByRole("button", {
      name: "Make a wish without a microphone",
      exact: true,
    })
    .click();
  await expect(response).toHaveValue("");
  await expect(send).toBeDisabled();
  await expect(
    page.getByRole("region", { name: "Your surprise result", exact: true }),
  ).toHaveCount(0);
});

test("long letters preserve every character across fitted pages", async ({
  page,
}) => {
  await mockMicrophone(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 568 });
  const letter =
    "  A small moment, with all my love.\n\n".repeat(38) + "Always yours.  \n";
  await page.route("**/api/shared/long-letter-test/", (route) =>
    route.fulfill({
      json: { ...demoExperience, memories: [], letterBody: letter },
    }),
  );
  await page.goto("/experience/long-letter-test");
  await blowCandles(page);
  await openLetter(page);
  let reconstructed = "";
  for (let index = 0; index < 70; index += 1) {
    await checkFixedScreen(page);
    reconstructed += await page
      .locator(".open-letter .story-text-content")
      .textContent();
    const next = page.getByRole("button", { name: "Next love letter page" });
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click();
  }
  expect(reconstructed).toBe(letter);
});

test("saved chapter order, visibility, motion, and music settings control the journey", async ({
  page,
}) => {
  await mockMicrophone(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const settings = defaultPresentation();
  settings.chapters = {
    celebration: false,
    heart: false,
    memories: false,
    letter: false,
  };
  settings.musicEnabled = false;
  settings.animationsEnabled = false;
  settings.copy.wishButton = "Make magic";
  settings.copy.finaleHeading = "Only you.\nAlways.";
  await page.route("**/api/shared/settings-test/", (route) =>
    route.fulfill({ json: { ...demoExperience, presentation: settings } }),
  );
  await page.goto("/experience/settings-test");
  await expect(page.locator(".love-journey")).toHaveClass(/is-calm/);
  await page.getByRole("button", { name: "Make magic", exact: true }).click();
  await expect(
    page.getByText("Make your wish, then gently blow", { exact: false }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.audioSignal = "blow";
  });
  await expect(
    page.getByRole("heading", { name: "Only you. Always." }),
  ).toBeVisible();
  await expect(page.locator(".journey-progress")).toHaveAttribute(
    "aria-label",
    "Always, you, chapter 2 of 2",
  );
  await expect(page.locator(".ending-gif")).toHaveAttribute(
    "src",
    "/animations/forever-hug-still.webp",
  );
  await expect(page.locator(".sound-control")).toHaveCount(0);
  expect(
    await page.locator("html").getAttribute("data-music-sources-started"),
  ).toBeNull();
  await checkFixedScreen(page);

  settings.chapters = {
    celebration: true,
    heart: false,
    memories: true,
    letter: true,
  };
  settings.chapterOrder = ["letter", "celebration", "memories", "heart"];
  settings.musicEnabled = true;
  settings.musicAutoplay = false;
  settings.musicVolume = 0.25;
  await page.reload();
  await page.getByRole("button", { name: "Make magic", exact: true }).click();
  await expect(
    page.getByText("Make your wish, then gently blow", { exact: false }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.audioSignal = "blow";
  });
  await expect(page.locator(".letter-screen")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play music", exact: true }),
  ).toBeVisible();
  expect(
    await page.locator("html").getAttribute("data-music-sources-started"),
  ).toBeNull();
  await page.getByRole("button", { name: "Play music", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-music-gain", "0.25");
  await page
    .getByRole("button", { name: "Open your letter", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "One more little thing", exact: true })
    .click();
  await expect(page.locator(".celebration-gif")).toHaveAttribute(
    "src",
    "/animations/flowers-for-you-still.webp",
  );
  await page.getByRole("button", { name: "There's more in my heart" }).click();
  await expect(page.locator(".memory-screen")).toBeVisible();
  await page.getByRole("button", { name: "Next memory", exact: true }).click();
  await page.getByRole("button", { name: "Next memory", exact: true }).click();
  await page
    .getByRole("button", { name: "A letter for you", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Only you. Always." }),
  ).toBeVisible();
  await expect(page.locator(".journey-progress")).toHaveAttribute(
    "aria-label",
    "Always, you, chapter 5 of 5",
  );
  await page.getByRole("button", { name: "Previous chapter" }).click();
  await expect(page.locator(".memory-screen")).toBeVisible();
});

test("creator can register, edit, upload, preview, publish, and revoke", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio");
  await expect(
    page.getByRole("button", { name: "Start with the sample" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Start with the sample" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continue" })
    .click();
  await page.getByLabel("Their name", { exact: true }).fill("Jamie");
  await page.getByLabel("Your name", { exact: true }).fill("Morgan");
  await page
    .getByLabel("A little opening note", { exact: true })
    .fill("A birthday made just for Jamie.");
  await page.getByLabel("Their birthday", { exact: true }).fill("2026-11-12");
  await page.getByRole("radio", { name: "Secret garden" }).check();
  await page.getByLabel("Accent color", { exact: true }).fill("#57b8a8");
  await page.getByLabel("Show birthday date", { exact: true }).check();
  await page
    .getByLabel("Use cover photograph as the story background", { exact: true })
    .check();
  await page.getByRole("link", { name: "Back to the sample story" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Leave your story?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Their name", { exact: true })).toHaveValue(
    "Jamie",
  );
  await page.getByRole("button", { name: "Save draft" }).click();
  const username = `test-${Date.now().toString(36)}`;
  await page
    .getByRole("dialog")
    .getByLabel("Username", { exact: true })
    .fill(username);
  await page
    .getByRole("dialog")
    .getByLabel("Password", { exact: true })
    .fill(`Test-only-${crypto.randomUUID()}`);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Your private draft is saved.")).toBeVisible();
  await page
    .getByRole("checkbox", { name: "I own or have permission", exact: false })
    .check();
  await page
    .getByLabel("Upload your photograph", { exact: true })
    .setInputFiles(path.resolve(__dirname, "../public/images/flowers.jpg"));
  await expect(
    page.getByText("Upload complete.", { exact: false }),
  ).toBeVisible({ timeout: 20000 });
  await page
    .getByRole("button", { name: "Your memories", exact: false })
    .click();
  await page.getByRole("button", { name: "Move memory 2 up" }).click();
  await expect(page.getByLabel("Memory 1 title", { exact: true })).toHaveValue(
    "Our little escape",
  );
  await page
    .getByRole("button", { name: "A love letter", exact: false })
    .click();
  await page
    .getByLabel("Your letter", { exact: true })
    .fill("This message belongs only to Jamie.");
  await page
    .getByRole("button", { name: "Little details", exact: false })
    .click();
  await page.getByLabel("Candles", { exact: true }).selectOption("5");
  await page.getByLabel("Starting music volume", { exact: true }).fill("0.45");
  await page.getByLabel("3D heart screen", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Move heart later", exact: true })
    .click();
  await page
    .getByLabel("Celebration artwork", { exact: true })
    .selectOption("/animations/forever-hug.gif");
  await page
    .getByLabel("Celebration image description", { exact: true })
    .fill("A hug for Jamie");
  await page
    .getByLabel("Upload final page artwork", { exact: true })
    .setInputFiles(
      path.resolve(__dirname, "../Pintrest/Teddy Bear Love GIF by BEARISH.gif"),
    );
  await expect(
    page.getByText("Upload complete.", { exact: false }),
  ).toBeVisible({ timeout: 20000 });
  await page
    .locator(".copy-settings")
    .filter({ hasText: "Celebration" })
    .locator("summary")
    .click();
  await page
    .getByLabel("Celebration heading", { exact: true })
    .fill("Jamie, this is your day.\nAll yours.");
  await page
    .getByLabel("Celebration message", { exact: true })
    .fill("Every little moment with you.");
  await page
    .locator(".copy-settings")
    .filter({ hasText: "Letter and final page" })
    .locator("summary")
    .click();
  await page
    .getByLabel("Final page heading", { exact: true })
    .fill("My favorite person.\nEvery day.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Your private draft is saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Their name", { exact: true })).toHaveValue(
    "Jamie",
  );
  await expect(page.getByLabel("Accent color", { exact: true })).toHaveValue(
    "#57b8a8",
  );
  await expect(
    page.getByLabel("A little opening note", { exact: true }),
  ).toHaveValue("A birthday made just for Jamie.");
  await page
    .getByRole("button", { name: "Little details", exact: false })
    .click();
  await expect(
    page.getByLabel("3D heart screen", { exact: true }),
  ).not.toBeChecked();
  await expect(page.locator(".chapter-order li").nth(1)).toContainText(
    "Memories",
  );
  await expect(
    page.getByLabel("Starting music volume", { exact: true }),
  ).toHaveValue("0.45");
  await page
    .locator(".copy-settings")
    .filter({ hasText: "Celebration" })
    .locator("summary")
    .click();
  await expect(
    page.getByLabel("Celebration heading", { exact: true }),
  ).toHaveValue("Jamie, this is your day.\nAll yours.");
  await checkNoOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("studio-configured.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await checkNoOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("studio-settings-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockMicrophone(page);
  await page.reload();
  await expect(page.getByLabel("Their name", { exact: true })).toHaveValue(
    "Jamie",
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Happy birthday, Jamie." }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "rose birthday cake with 5 lit candles",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("A birthday made just for Jamie.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".birthday-date")).toHaveText("November 12");
  expect(
    await page
      .locator(".love-journey")
      .evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--pink").trim(),
      ),
  ).toBe("#57b8a8");
  await expect(page.locator(".journey-cover-backdrop img")).toHaveAttribute(
    "src",
    /\/api\/media\//,
  );
  await blowCandles(page);
  await expect(
    page.getByRole("heading", { name: "Jamie, this is your day. All yours." }),
  ).toBeVisible();
  await expect(page.locator(".celebration-gif")).toHaveAttribute(
    "src",
    "/animations/forever-hug.gif",
  );
  await expect(page.locator("html")).toHaveAttribute("data-music-gain", "0.45");
  await page.getByRole("button", { name: "Back to editor" }).click();
  await page
    .getByRole("button", { name: "Seal & share", exact: false })
    .click();
  await page.getByRole("button", { name: "Publish experience" }).click();
  await expect(
    page.getByText("Sealed with love. Your private link is ready."),
  ).toBeVisible();
  const privateUrl = await page
    .getByLabel("Your private link", { exact: true })
    .inputValue();
  const visitor = await browser.newContext();
  const recipient = await visitor.newPage();
  await mockMicrophone(recipient);
  await recipient.goto(privateUrl);
  await expect(
    recipient.getByRole("heading", { name: "Happy birthday, Jamie." }),
  ).toBeVisible();
  await blowCandles(recipient);
  await expect(
    recipient.getByRole("heading", {
      name: "Jamie, this is your day. All yours.",
    }),
  ).toBeVisible();
  await expect(recipient.locator(".celebration-gif")).toHaveAttribute(
    "src",
    "/animations/forever-hug.gif",
  );
  await expect(recipient.locator("html")).toHaveAttribute(
    "data-music-gain",
    "0.45",
  );
  await openLetter(recipient);
  await expect(
    recipient.locator(".open-letter .story-text-content"),
  ).toHaveText("This message belongs only to Jamie.");
  await recipient
    .getByRole("button", { name: "One more little thing", exact: true })
    .click();
  await expect(
    recipient.getByRole("heading", { name: "My favorite person. Every day." }),
  ).toBeVisible();
  await expect(recipient.locator(".ending-gif")).toHaveAttribute(
    "src",
    /\/api\/media\/.*\?share=/,
  );
  await checkImages(recipient);
  await page
    .getByRole("button", { name: "Little details", exact: false })
    .click();
  await page
    .locator(".copy-settings")
    .filter({ hasText: "Celebration" })
    .locator("summary")
    .click();
  await page
    .getByLabel("Celebration heading", { exact: true })
    .fill("An unpublished heading");
  await page
    .getByRole("button", { name: "A love letter", exact: false })
    .click();
  await page
    .getByLabel("Your letter", { exact: true })
    .fill("An unpublished change.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Your private draft is saved.")).toBeVisible();
  await recipient.reload();
  await blowCandles(recipient);
  await expect(
    recipient.getByRole("heading", {
      name: "Jamie, this is your day. All yours.",
    }),
  ).toBeVisible();
  await openLetter(recipient);
  await expect(
    recipient.locator(".open-letter .story-text-content"),
  ).toHaveText("This message belongs only to Jamie.");
  await page
    .getByRole("button", { name: "Seal & share", exact: false })
    .click();
  await checkNoOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("studio-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await checkNoOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("studio-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Revoke link" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continue" })
    .click();
  await expect(
    page.getByText("The link has been revoked.", { exact: false }),
  ).toBeVisible();
  await recipient.goto(privateUrl);
  await expect(
    recipient.getByRole("heading", { name: "A little story, out of reach." }),
  ).toBeVisible();
  await visitor.close();
  await page.getByRole("button", { name: "Delete this experience" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continue" })
    .click();
  await expect(page.getByText("The story has been deleted.")).toBeVisible();
});

test("long names fit small screens without covering surrounding content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/shared/long-name-test/", (route) =>
    route.fulfill({
      json: { ...demoExperience, recipientName: "W".repeat(50) },
    }),
  );
  await page.goto("/experience/long-name-test");
  await expect(page.locator("h1")).toContainText("W".repeat(50));
  await checkFixedScreen(page);
  const bounds = await page.evaluate(() => {
    const hero = document
      .querySelector(".journey-stage")!
      .getBoundingClientRect();
    const heading = document.querySelector("h1")!.getBoundingClientRect();
    const footer = document
      .querySelector(".journey-footer")!
      .getBoundingClientRect();
    const button = document
      .querySelector(".wish-button")!
      .getBoundingClientRect();
    return {
      heroTop: hero.top,
      heroBottom: hero.bottom,
      headingTop: heading.top,
      footerTop: footer.top,
      buttonBottom: button.bottom,
    };
  });
  expect(bounds.headingTop).toBeGreaterThanOrEqual(bounds.heroTop);
  expect(bounds.buttonBottom).toBeLessThan(bounds.footerTop);
  expect(bounds.heroBottom).toBeLessThan(568);
});
