const nodemailer = require("nodemailer");
require("dotenv").config();

// const sendEmail = async (options) => {
//     const transporter = nodemailer.createTransport({
//         host:"smtp.gmail.com",
//         service:"gmail",
//           port:587,
//         auth: {
//             user:process.env.user,
//             pass:process.env.password
//         },
//         tls:{
//             rejectUnauthorized: false,
//            },
//     });
//     const fromAddress = `"${process.env.from_Name}" <${process.env.user}>`;

//     try {
//         const info = await transporter.sendMail({
//             from: fromAddress,
//             to: options.email,
//             subject: options.subject,
//             html: options.html
//         });

//         console.log("Message sent: %s", info.messageId);
//         return info;
//     } catch (error) {
//         console.error("Error sending email:", error);
//         throw error;
//     }
// };


const sendEmail = async (options) => {
    const transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",  // Use Zoho SMTP server
        port: 465,  // Use 465 for SSL
        secure: true,  // true for 465, false for other ports like 587
        auth: {
            user: process.env.ZOHO_USER,  // Your Zoho email address
            pass: process.env.ZOHO_PASSWORD  // Your Zoho password or app-specific password
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    const fromAddress = `"${process.env.FROM_NAME}" <${process.env.ZOHO_USER}>`;

    try {
        const info = await transporter.sendMail({
            from:fromAddress,
            to: options.email,
            subject: options.subject,
            html: options.html
        });

        console.log("Message sent: %s", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
};







module.exports = sendEmail;






module.exports = sendEmail;



