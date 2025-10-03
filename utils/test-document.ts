import { documentAgent } from "./agent";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function testDocumentAgent() {
  console.log("🧪 Testing Document Processing Agent...\n");

  try {
    
    console.log("📄 Test 1: Basic Document Analysis");
    const result1 = await documentAgent(
      "Analyze the AIGovernance.pdf file and provide a comprehensive summary of what this project is about"
    );
    console.log("Response:", result1.response);
    console.log("---\n");

    

    console.log("✅ All tests completed successfully!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testDocumentAgent();

