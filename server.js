const express = require('express');
const sgMail = require('@sendgrid/mail');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
 app.use(cors()); //(for local run)

// app.use(cors({       //(for vercel)
//     origin: function (origin, callback) {
//         // Allow requests with no origin (like mobile apps or curl requests)
//         if (!origin) return callback(null, true);

//         const allowedOrigins = [
//             'http://localhost:5173',
//             'http://localhost:3000',
//             'https://vercel-frontend-mu-jade.vercel.app'
//         ];

//         // Allow any vercel.app subdomain
//         if (origin.endsWith('.vercel.app')) {
//             return callback(null, true);
//         }

//         if (allowedOrigins.indexOf(origin) !== -1) {
//             callback(null, true);
//         } else {
//             callback(new Error('Not allowed by CORS'));
//         }
//     },
//     credentials: true,
//     methods: ['GET', 'POST', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization']
// }));



app.use(express.json());

// Set SendGrid API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();

// Generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP Email
app.post('/api/send-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Generate OTP
        const otp = generateOTP();

        // Store OTP with 10 minute expiry
        otpStore.set(email, {
            otp: otp,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
        });

        // Email content
        const msg = {
            to: email,
            from: process.env.SENDER_EMAIL,
            subject: 'B-Buddy - Your OTP Code',
            text: `Your OTP code is: ${otp}. Valid for 10 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                        <h1 style="color: white; margin: 0;">B-Buddy</h1>
                    </div>
                    <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #333; margin-top: 0;">Email Verification</h2>
                        <p style="color: #666; font-size: 16px;">Your OTP code is:</p>
                        <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
                            <h1 style="color: #667eea; font-size: 42px; letter-spacing: 10px; margin: 0;">${otp}</h1>
                        </div>
                        <p style="color: #666; font-size: 14px;">This code will expire in <strong>10 minutes</strong>.</p>
                        <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
                    </div>
                </div>
            `,
        };

        // Send email
        await sgMail.send(msg);

        console.log(`✅ OTP sent to ${email}: ${otp}`);

        res.json({
            success: true,
            message: 'OTP sent successfully'
        });

    } catch (error) {
        console.error('❌ Error sending OTP:', error.response ? error.response.body : error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
            error: error.message
        });
    }
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        const storedData = otpStore.get(email);

        if (!storedData) {
            return res.status(400).json({
                success: false,
                message: 'No OTP found for this email. Please request a new one.'
            });
        }

        // Check if OTP expired
        if (Date.now() > storedData.expiresAt) {
            otpStore.delete(email);
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.'
            });
        }

        // Verify OTP
        if (storedData.otp === otp) {
            otpStore.delete(email); // Clear OTP after successful verification
            console.log(`✅ OTP verified successfully for ${email}`);
            return res.json({
                success: true,
                message: 'OTP verified successfully'
            });
        } else {
            console.log(`❌ Invalid OTP attempt for ${email}`);
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP. Please try again.'
            });
        }

    } catch (error) {
        console.error('❌ Error verifying OTP:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify OTP',
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'B-Buddy API Server',
        endpoints: {
            sendOtp: 'POST /api/send-otp',
            verifyOtp: 'POST /api/verify-otp',
            health: 'GET /api/health'
        }
    });
});

app.listen(PORT, () => {
    console.log('=================================');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📧 SendGrid sender: ${process.env.SENDER_EMAIL}`);
    console.log('=================================');
});