/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { ModelSelector } from "./ModelSelector";

let now = Date.now();
beforeEach(() => {
  now += 600_000;
  jest.spyOn(Date, "now").mockReturnValue(now);
});
afterEach(() => jest.restoreAllMocks());

function config(available: boolean) {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
    tiers: [], configuredProviders: available ? ["openrouter"] : ["gemini"],
    availableModels: available ? [{ id: "openrouter/free", displayName: "OpenRouter Free Router", provider: "openrouter", providerDisplayName: "OpenRouter" }] : [],
  }) });
}

it("selects the free router explicitly and identifies the model in accessible controls", async () => {
  config(true);
  const onChange = jest.fn();
  const { rerender } = render(<ModelSelector value={{}} onChange={onChange} />);
  fireEvent.click(await screen.findByRole("button", { name: "Try free models" }));
  expect(onChange).toHaveBeenCalledWith({ provider: "openrouter", model: "openrouter/free" });
  rerender(<ModelSelector value={{ provider: "openrouter", model: "openrouter/free" }} onChange={onChange} disabled />);
  expect(screen.getByLabelText("Provider")).toHaveValue("openrouter");
  expect(screen.getByLabelText("Model")).toHaveValue("openrouter/free");
  expect(screen.getByRole("button", { name: "Try free models" })).toBeDisabled();
  expect(screen.getByText(/Quality, response time/)).toBeInTheDocument();
});

it("omits the free option when no OpenRouter key is configured", async () => {
  config(false);
  render(<ModelSelector value={{}} onChange={jest.fn()} />);
  await screen.findByRole("button", { name: "Advanced" });
  expect(screen.queryByRole("button", { name: "Try free models" })).not.toBeInTheDocument();
});

it("selects the matching provider when choosing a model directly", async () => {
  config(true);
  const onChange = jest.fn();
  render(<ModelSelector value={{}} onChange={onChange} />);
  fireEvent.click(await screen.findByRole("button", { name: "Advanced" }));
  fireEvent.change(screen.getByLabelText("Model"), { target: { value: "openrouter/free" } });
  expect(onChange).toHaveBeenLastCalledWith({ provider: "openrouter", model: "openrouter/free" });
});
