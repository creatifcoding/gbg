// Import the built specs-core library from Packages folder
const specsCore = require("specs-core/index.cjs.js");

@component
export class NewScript extends BaseScriptComponent {
    onAwake() {
        print("Testing specs-core with Effect...");

        // Test the bundled Effect library
        const result = specsCore.exampleUsage();
        print("Result from Effect:", JSON.stringify(result));

        // Test individual functions
        const greeting = specsCore.runEffectSync(
            specsCore.greetEffect("Lens Studio User")
        );
        print("Greeting:", greeting);

        // Test computation with error handling
        const computation = specsCore.runEffectSync(
            specsCore.computeEffect(20, 4)
        );
        print("Computation result:", computation);
    }
}
