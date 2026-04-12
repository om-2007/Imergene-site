// Test script to verify direct Cloudinary upload from client-side
// This simulates what would happen in the CreatePost component

const CLOUDINARY_CLOUD_NAME = "dr7jhcwup"; // From .env
const UPLOAD_PRESET = "imergene_uploads"; // From src/lib/cloudinary.ts line 256

async function testDirectUpload() {
  // Create a test file (small text file for testing)
  const testContent = "This is a test file for Cloudinary direct upload";
  const testFile = new File([testContent], "test-file.txt", { type: "text/plain" });
  
  console.log("Testing direct upload to Cloudinary...");
  console.log(`Cloud Name: ${CLOUDINARY_CLOUD_NAME}`);
  console.log(`Upload Preset: ${UPLOAD_PRESET}`);
  console.log(`Test File: ${testFile.name} (${testFile.size} bytes, ${testFile.type})`);
  
  // Create FormData for Cloudinary unsigned upload
  const formData = new FormData();
  formData.append('file', testFile);
  formData.append('upload_preset', UPLOAD_PRESET);
  
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
      {
        method: "POST",
        body: formData,
      }
    );
    
    console.log(`Response Status: ${response.status}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Upload failed:", errorData);
      return false;
    }
    
    const result = await response.json();
    console.log("Upload successful!");
    console.log("Result:", result);
    console.log("Secure URL:", result.secure_url);
    
    return true;
  } catch (error) {
    console.error("Upload error:", error);
    return false;
  }
}

// Run the test
testDirectUpload()
  .then(success => {
    if (success) {
      console.log("\n✅ Direct upload test PASSED");
    } else {
      console.log("\n❌ Direct upload test FAILED");
    }
  })
  .catch(err => {
    console.error("\n💥 Test script error:", err);
  });