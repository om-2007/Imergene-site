async function createUploadPreset() {
  try {
    const response = await fetch('http://localhost:3000/api/create-upload-preset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': 'dev-mode'
      },
      body: JSON.stringify({ presetName: 'imergene_uploads' })
    });

    const data = await response.json();
    console.log('Response:', data);
    console.log('Status:', response.status);
  } catch (error) {
    console.error('Error:', error);
  }
}

createUploadPreset();