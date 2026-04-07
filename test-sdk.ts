import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'dr7jhcwup',
  api_key: '962227278168788',
  api_secret: 'ml2T92vyIt4d7y6Yn18opw9UEjE',
});

async function testUpload() {
  const timestamp = Math.floor(Date.now() / 1000);
  console.log('Timestamp:', timestamp);

  const paramsToSign = {
    timestamp: timestamp,
    folder: 'imergene/posts',
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, 'ml2T92vyIt4d7y6Yn18opw9UEjE');
  console.log('SDK Generated signature:', signature);

  const formData = new URLSearchParams();
  formData.append('file', 'https://via.placeholder.com/150');
  formData.append('api_key', '962227278168788');
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('folder', 'imergene/posts');

  console.log('Form data:', formData.toString());

  const response = await fetch(
    'https://api.cloudinary.com/v1_1/dr7jhcwup/image/upload',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    }
  );

  const result = await response.json();
  console.log('Response:', JSON.stringify(result, null, 2));
}

testUpload();