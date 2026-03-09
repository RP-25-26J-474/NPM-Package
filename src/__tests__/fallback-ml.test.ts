import { buildFallbackProfileFromPredictions, deriveTokensFromProfile } from "../utils";
import { predictFallbackTokens } from "../fallback-ml/predict";

import { setUserAgent, setWindowSize } from "./testUtils";

describe("fallback ML", () => {
  afterEach(() => {
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 1,
    });
  });

  it("reads desktop browser metadata and returns the exact FNN outputs for that input", () => {
    setWindowSize(1440, 900);
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 2,
    });
    setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
    );

    expect(predictFallbackTokens()).toEqual({
      font_size: 22,
      line_height: 1.6,
      target_size: 31.69,
    });
  });

  it("reads mobile browser metadata and returns the exact FNN outputs for that input", () => {
    setWindowSize(390, 844);
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: 3,
    });
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1"
    );

    expect(predictFallbackTokens()).toEqual({
      font_size: 22,
      line_height: 1.6,
      target_size: 27.41,
    });
  });

  it("builds and applies the exact fallback profile values into adaptive tokens", () => {
    const outputs = {
      font_size: 18.2,
      line_height: 1.52,
      target_size: 33.7,
    };

    const profile = buildFallbackProfileFromPredictions(outputs);
    const tokens = deriveTokensFromProfile(profile);

    expect(profile).toMatchObject({
      font_size: 18.2,
      line_height: 1.52,
      target_size: 33.7,
      element_spacing_x: 11,
      element_spacing_y: 9,
      element_padding_x: 8,
      element_padding_y: 8,
    });
    expect(tokens.typography.body).toBe("18.2px");
    expect(tokens.typography.lineHeight).toBe(1.52);
    expect(tokens.controls.minTargetSize).toBe(33.7);
    expect(tokens.spacing.gapX).toBe(11);
    expect(tokens.spacing.gapY).toBe(9);
  });
});
