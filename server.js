const express = require("express")
const compression = require ('compression')
const helmet = require ('helmet')
const morgan = require('morgan')
const app = express()
const PORT = 4410
app.use(express.json())
const cors = require('cors')
const fileUploader = require('express-fileupload')
const db = require('./config/db')
const router = require('./routers/userRouter')
const depositRouter = require('./routers/depositRouter')
const investmentRouter = require('./routers/investmestRouter')
const kycVerification = require('./routers/kycRouter')
const Ticket = require('./routers/ticketRouter')

const twoFactorAuthRoutes = require('./routers/2faRouter');

const axios = require('axios')
const cron = require('node-cron')

// // Cron job to ping the website every 5 minutes and send an email
// cron.schedule('*/5 * * * *', async () => {
//     try {
//         await axios.get('https://nexus-wealth.onrender.com');
//         console.log('Pinged website to keep it awake');

//         // // Prepare and send the wake-up email
//         // const subject = "Wake up website";
//         // const html = wakeUpMail();
//         // const regEmailData = {
//         //     email: process.env.WAKE_UP_EMAIL, // Use the environment variable
//         //     subject,
//         //     html
//         // };
//         // await sendEmail(regEmailData);
//     } catch (error) {
//         console.error('Error in cron job:', error.message);
//     }
// });



cron.schedule('0,30 * * * *', async () => {
    try {
      const timeout = 10000; // 10 seconds
      const response = await axios.get('https://nexuswealthbackup.onrender.com', { timeout });
      console.log('Pinged website to keep it awake');
  
      // // Prepare and send the wake-up email
      // const subject = "Wake up website";
      // const html = wakeUpMail();
      // const regEmailData = {
      //   email: process.env.WAKE_UP_EMAIL, // Use the environment variable
      //   subject,
      //   html
      // };
      // try {
      //   await sendEmail(regEmailData);
      // } catch (emailError) {
      //   console.error('Error sending email:', emailError);
      // }
    } catch (error) {
      console.error('Error in cron job:', error);
    }
  });



app.use(compression()); // Enable gzip compression
app.use(morgan('combined')); // Enable request logging
app.use(helmet()); // Set various HTTP headers for security
app.use(cors({origin:"*"}));
app.use(fileUploader({
    useTempFiles: true,
}))
app.use(router)
app.use(depositRouter)
app.use(investmentRouter)
app.use(kycVerification)
app.use(Ticket)

app.use('/', twoFactorAuthRoutes);



app.listen(PORT, ()=>{
    console.log(`app is listening to ${PORT}`)
})
