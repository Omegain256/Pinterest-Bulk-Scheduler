const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://localhost:3000/api/generate', {
      urls: ['https://decormystry.com/plus-size-rodeo-outfits/'],
      niche: 'Fashion & Outfits',
      aspectRatio: '9:16'
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) console.error(err.response.data);
    else console.error(err.message);
  }
}
test();
