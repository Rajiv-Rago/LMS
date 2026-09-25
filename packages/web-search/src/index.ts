import { toolsProvider } from "./toolsProvider";
import { promptPreprocessor } from "./promptPreprocessor";
import { pluginConfigSchematics } from "./config";
import { donationManager } from "./donations";

export async function main(context: any) {
  context.withConfigSchematics(pluginConfigSchematics);
  context.withToolsProvider(toolsProvider);
  context.withPromptPreprocessor(promptPreprocessor);
  
  // Expose donation manager for tools
  (context as any).donationManager = donationManager;
}
