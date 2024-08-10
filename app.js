const express = require('express');
const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv')

dotenv.config();


const app = express();
const port = 3000;

const upload = multer({ dest: 'uploads/' });


const stsClient = new STSClient({ region: process.env.AWS_REGION }); 

async function assumeRole() {
    const params = {
        RoleArn: process.env.ROLE_ARN, 
        RoleSessionName: process.env.ROLE_SESSION_NAME, 
    };

    const command = new AssumeRoleCommand(params);
    const data = await stsClient.send(command);
    return data.Credentials;
}


app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        
        const creds = await assumeRole();
        
        const s3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: creds.AccessKeyId,
                secretAccessKey: creds.SecretAccessKey,
                sessionToken: creds.SessionToken,
            },
        });

        
        const fileContent = fs.readFileSync(req.file.path);
        const uploadParams = {
            Bucket: process.env.S3_BUCKET,
            Key: `${Date.now()}_${path.basename(req.file.originalname)}`,
            Body: fileContent,
            ContentType: req.file.mimetype,
        };

        
        const uploadResult = await s3Client.send(new PutObjectCommand(uploadParams));

        fs.unlinkSync(req.file.path);

        res.json({
            message: 'Image uploaded successfully!',
            uploadResult,
        });
    } catch (err) {
        console.error('Error uploading image:', err);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});