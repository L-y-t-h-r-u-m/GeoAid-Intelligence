const cloudinary = require('cloudinary').v2;

/**
 * Configure standard Cloudinary SDK.
 * User will need to drop credentials here or via env.
 */
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// });

/**
 * Mock upload handler
 */
const uploadToCloudinary = async (filePath) => {
  // return cloudinary.uploader.upload(filePath);
  return { secure_url: 'https://mock-cloudinary-url.placeholder/img.jpg' };
};

module.exports = { uploadToCloudinary };
