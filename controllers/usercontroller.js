const userModel = require('../models/userModel')
const otpModel = require('../models/otpModel')
const otpgenerator = require('otp-generator')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const sendEmail = require('../middlewares/mail')
const {loginNotificationMail,otpVerifyMail} = require('../utils/mailTemplates')
const transationModel = require('../models/investmentModel')
const depositModel = require('../models/depositModel')
const mongoose = require ('mongoose')
const cloudinary = require('../helpers/cloudinary')
const {moneyDepositNotificationMail,generateEncourageEmail} = require('../utils/mailTemplates')




const signUpUser = async (req, res) => {
    try {
        const { userName, email, mobile,country, password, firstName, lastName, address, zipCode, city } = req.body;
        
        const normalizedEmail = email.toLowerCase().replace(/\s/g, '');
        const referralUsername = req.query.referral; // Parse referral parameter from URL
       const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const passwordPattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/;

        if (!userName || userName.trim().length === 0) {
            throw new Error("Username field cannot be empty");
        }

        if (!mobile || mobile.trim().length === 0) {
            throw new Error("Mobile number Needed");
        }


        if (!password || password.trim().length === 0) {
            throw new Error("Password field cannot be empty");
        } else if (!passwordPattern.test(password)) {
            throw new Error("Password must contain at least 8 characters, including at least one uppercase letter, one lowercase letter, and one number");
        }
    

        if (!email || !emailPattern.test(email)) {
            throw new Error("Invalid email address format");
        }

        const isEmailExists = await userModel.findOne({ email: normalizedEmail });
        if (isEmailExists) {
            throw new Error("User with this email already registered");
        }

        const referralLink = await generateReferralLink(userName);
         // Check if referral exists
         if (referralUsername) {
            // Look up the user based on the referral username
            const referredUser = await userModel.findOne({ userName: referralUsername });

            if (referredUser) {
                // Increment referral count by 1
                referredUser.referralCount += 1;
                // Add 20 to referral bonus
                referredUser.referalWallet += 10;
                // Save changes to the referred user document
                await referredUser.save();
            }
        }

        // Generate a random OTP
        const OTP = otpgenerator.generate(6, {
            digits: true,
            lowerCaseAlphabets: false,
            alphabets: false,
            upperCaseAlphabets: false,
            specialChars: false
        }).replace(/\D/g, ''); // Remove non-digit characters from the generated OTP

        console.log("Generated OTP:", OTP);

        // Hash the OTP and save it to the database
        const hashedOTP = await hashOTP(OTP);

        const userOtp = new otpModel({
            otp: hashedOTP,
        });

        const savedOtp = await userOtp.save();

        // const picture = await new Promise((resolve, reject) => {
        //     cloudinary.uploader.upload(req.files.profilePicture.tempFilePath, {
        //         allowed_formats: ['txt', 'doc', 'pdf', 'docx', 'png', 'jpeg'], // Allow these file formats
        //         max_file_size: 2000000 // Maximum file size in bytes (2MB)
        //     }, (error, result) => {
        //         if (error) {
        //             reject(error);
        //         } else {
        //             resolve(result);
        //         }
        //     });
        // });
        const createFolderResult = await cloudinary.api.create_folder('nexus-wealth');
        let picture = {}; // Empty object for profile picture
        if (req.files && req.files.profilePicture) {
            picture = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload(req.files.profilePicture.tempFilePath, {
                    folder: 'nexus-wealth', // Specify the folder name here
                    allowed_formats: ['txt', 'doc', 'pdf', 'docx', 'png', 'jpeg'], // Allow these file formats
                    max_file_size: 2000000 // Maximum file size in bytes (2MB)
                }, (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });
            });
        }



        const salt = await bcrypt.genSaltSync(10);
        const hashedPassword = await bcrypt.hashSync(password, salt);
              const nameCase = userName.toLowerCase();
        const user = new userModel({
            userName:nameCase,
            mobile,
            country,
            address,
            zipCode,
            city,
            firstName,
            lastName,
            email: normalizedEmail,
            password: hashedPassword,
            otpId: savedOtp._id,
            profilePicture: { public_id: picture.public_id, url: picture.url },
            referralLink: referralLink 
        });

        user.balance = 0;
        user.earnings = 0;

        await user.save();

        const token = jwt.sign({ email: user.email, userId: user._id },
            process.env.SECRET_KEY, { expiresIn: "30mins" });

        
        const html = otpVerifyMail(OTP);     
        const regEmmailData = {
            email: user.email,
            subject: "User Registration",
            html
        };
       await sendEmail(regEmmailData);

        // // for (const recipient of recipients) {
        // //     const regEmmailData = {
        // //         email: recipient,
        // //         subject: "User Registration",
        // //         html
        // //     };
        //     await sendEmail(regEmmailData);
        // }
       

        res.status(200).json({ message: 'Signup successful, please check your email for OTP verification', data: user, token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}




const hashOTP = async (otp) => {
    const salt = bcrypt.genSaltSync(10);
    const hashedOTP = bcrypt.hashSync(otp, salt);
    return hashedOTP;
};

// Function to generate referral link
async function generateReferralLink(username) {
    try {
        // Your base URL
        const baseUrl = 'https://www.nexuswealth-firm.com/register';

        // Construct the referral link with username as parameter
        const referralLink = `${baseUrl}?reference=${encodeURIComponent(username)}`;
        
        return referralLink;
    } catch (error) {
        console.error("Error generating referral link:", error);
        return null;
    }
}








const verifyOtp = async (req, res) => {
    try {
        const { token } = req.params;
        const { otp } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Token not found' });
        }
        if (!otp) {
            return res.status(400).json({ message: 'OTP input cannot be empty' });
        }

        const { email } = jwt.verify(token, process.env.SECRET_KEY);
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: 'Email not assigned' });
        }
        if (user.isVerified) {
            return res.status(400).json({ message: 'User already verified' });
        }

        const latestOtp = await otpModel.findOne({ _id: user.otpId });

        if (!latestOtp) {
            return res.status(404).json({ message: 'otp time expired please request for another' });
        }
        
        const isOtpValid = await bcrypt.compare(otp, latestOtp.otp);

        if (!isOtpValid) {
            return res.status(400).json({ message: 'OTP not valid' });
        } else {
            user.isVerified = true;
            await user.save();

            await otpModel.deleteOne({ _id: latestOtp._id }); // Delete the used OTP

            res.status(200).json({ message: 'User verified successfully' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};





// Define a utility function to check if the user is within the cooldown period




const resendVerificationOtp = async (req, res) => {
    try {
        const { email } = req.body;

        // Check if the user with the provided email exists
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'User is already verified' });
        }

        
        // Check if the user has requested an OTP in the last 1 minute
        const cooldownDuration = 60000; // 1 minute in milliseconds
        const currentTime = Date.now();
        if (user.lastOtpRequest && (currentTime - user.lastOtpRequest) < cooldownDuration) {
            return res.status(400).json({ message: 'You can request OTP only once per minute' });
        }

        // Generate a new OTP
        const OTP = otpgenerator.generate(6, {
            digits: true,
            lowerCaseAlphabets: false,
            alphabets: false,
            upperCaseAlphabets: false,
            specialChars: false
        }).replace(/\D/g, ''); // Remove non-digit characters from the generated OTP

        console.log("Generated OTP:", OTP);

        // Hash the OTP
        const hashedOTP = await hashOTP(OTP);

        // Create a new OTP document
        const otpDoc = new otpModel({
            otp: hashedOTP
        });

        // Save the OTP document
        const savedOtp = await otpDoc.save();

        // Update the user's OTP ID with the new OTP document ID
        user.otpId = savedOtp._id;

        // Save the user
        await user.save();
        const token = jwt.sign({ email: user.email, userId: user._id }, process.env.SECRET_KEY, { expiresIn: "30mins" });

        // Prepare and send the new verification email
        const subject = "Resend Verification OTP";
        const html = otpVerifyMail(OTP);
        const regEmailData = {
            email: user.email,
            subject,
            html
        };
        await sendEmail(regEmailData);

        res.status(200).json({ message: 'Verification OTP resent successfully' ,token});
    } catch (error) {
        console.error("Error in resendVerificationOtp:", error);
        res.status(500).json({ message: error.message });
    }
};







const login = async (req, res) => {
    try {
        const { emailOrUserName, password } = req.body;

        // Normalize the emailOrUserName input (convert to lowercase and remove spaces)
        const normalizedInput = emailOrUserName.toLowerCase().replace(/\s/g, '');

        const user = await userModel.findOne({ $or: [{ email: normalizedInput }, { userName: normalizedInput }] });
        
        if (!user) {
            return res.status(401).json({ message: 'User with this email/username is not registered' });
        }

        if (!user.isVerified) {
            return res.status(400).json({ message: 'User not verified' });
        }

        if (user.deactivate === true) {
            return res.status(400).json({ message: 'User Account not valid' });
        }

        const matchedPassword = await bcrypt.compare(password, user.password);
        if (!matchedPassword) {
            return res.status(400).json({ message: "Incorrect password" });
        }
         user.isLoggedIn = true

        const timestamp = new Date().toUTCString();
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        const token = jwt.sign({
            email: user.email,
            userId: user._id,
            isAdmin: user.isAdmin,
            isLoggedIn:user.isLoggedIn
        }, process.env.SECRET_KEY, { expiresIn: "1d" });

        const recipients = process.env.loginMails.split(',').filter(email => email.trim() !== ''); // Filter out empty emails
        
        if (recipients.length === 0) {
            throw new Error("No recipients defined");
        }

        const html = loginNotificationMail(user, timestamp, ipAddress, userAgent);
        const emailData = {
            subject: "User Login Notification",
            html
        };

        for (const recipient of recipients) {
            emailData.email = recipient.trim();
            await sendEmail(emailData);
        }

        res.status(200).json({ message: 'Login successful', data: user, token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const logout = async (req, res) => {
    try {
        const { userId } = req.params;

        // Find the user by ID
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update the isLoggedIn status to false
        user.isLoggedIn = false;
        await user.save();

        // Clear the token from request headers
        req.headers.authorization = null;

        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};





const ViewProfile = async (req,res)=>{
    try {
        const {userId} = req.params
        const user = await userModel.findOne({_id:userId})
        res.status(200).json({message:'user:', data:user})
        
    } catch (error) {
        res.status(500).json(error.message)
    }
}


const assignMoneyToUser = async (req, res) => {
    try {
        // const { adminId } = req.params;
        const { userId, amount } = req.body;

        // // Find the admin
        // const admin = await userModel.findById(adminId);
        // if (!admin || !admin.isAdmin) {
        //     return res.status(400).json({ message: 'user is not an admin , cannot perform function' });
       // }

          // Check if userId is a valid ObjectId
          if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({ message: 'Invalid user ID, please pass the correct user ID' });
        }

    
        // Find the user
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        // Validate the amount
        if (isNaN(amount) ) {
            return res.status(400).json({ message: 'Invalid amount' });
        }
        

         // Validate the amount
         if (!amount || parseFloat(amount) === 0) {
            return res.status(400).json({ message: 'Amount must be provided and greater than 0' });
        }

        // Assign money to user
        user.depositWallet += parseFloat(amount);
        user.accountBalance+= parseFloat(amount);
        await user.save();

        const html = moneyDepositNotificationMail(user, amount);
        const emailData = {
            subject: "Money Deposit Notification",
            html
        };

        // Send email notification to user
        await sendEmail({ email: user.email, ...emailData });
        res.status(200).json({ message: 'Money assigned to user successfully', user });
    } catch (error) {
        console.error('Error assigning money to user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


const assignProfitToUser = async (req, res) => {
    try {
        // const { adminId } = req.params;
        const { userId, profit } = req.body;

        // Find the admin
        // const admin = await userModel.findById(adminId);
        // if (!admin || !admin.isAdmin) {
        //     return res.status(400).json({ message: 'user is not an admin , cannot perform function' });
        // }

          // Check if userId is a valid ObjectId
          if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({ message: 'Invalid user ID, please pass the correct user ID' });
        }

    
        // Find the user
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        // Validate the profit
        if (isNaN(profit) ) {
            return res.status(400).json({ message: 'Invalid amount' });
        }
        

         // Validate the profit
         if (!profit || parseFloat(profit) === 0) {
            return res.status(400).json({ message: 'Amount must be provided and greater than 0' });
        }

        // Assign money to user
        user.intrestWallet += parseFloat(profit);
        user.accountBalance+= parseFloat(profit);
        
        await user.save();

        res.status(200).json({ message: 'profits assigned to user successfully', user });
    } catch (error) {
        console.error('Error assigning money to user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const deleteUser = async (req, res) => {
    try {

        // const { adminId } = req.params;
        const { email } = req.body;

        // Find the admin
        // const admin = await userModel.findById(adminId);
        // if (!admin || !admin.isAdmin) {
        //     return res.status(400).json({ message: 'Invalid admin ID' });
        // }

        // Find the user
        const user = await userModel.findOne({email})
        if (!user) {
            return res.status(400).json({ message: 'user with this email does not exist' });
        }

        // Delete the user
       
        const deleteUser = await userModel.findOneAndDelete({email})

        res.status(200).json({ message: 'User deleted successfully', data:deleteUser });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const deactivateUser = async (req, res) => {
    try {
        const { email } = req.body;

        // Find the user
        const user = await userModel.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'User with this email does not exist' });
        }

        // Check if the user account is already deactivated
        if (user.deactivate === true) {
            return res.status(400).json({ message: 'Account already deactivated' });
        }

        // Update the user's deactivate field to true
        user.deactivate = true;
        await user.save();

        res.status(200).json({ message: 'User account deactivated successfully', data: user });
    } catch (error) {
        console.error('Error deactivating user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}
;





const updateUser = async (req, res) => {
    try {
        const { firstName, lastName, address, state, zipCode, city } = req.body;
        const { userId } = req.params;
        const user = await userModel.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                message: "User does not exist"
            });
        }

        const userData = {
            firstName: firstName || user.firstName,
            lastName: lastName || user.lastName,
            profilePicture: user.profilePicture, // Keep the original profile picture URL
            address: address || user.address,
            state: state || user.state,
            zipCode: zipCode || user.zipCode,
            city: city || user.city
        };

        if (req.files && req.files.profilePicture) {
            const userProfile = req.files.profilePicture.tempFilePath;
            const public_id = user.profilePicture.url.split('/').pop().split('.')[0];
            
            // Destroy the previous profile picture on Cloudinary
            await cloudinary.uploader.destroy(public_id);

            // Upload the new profile picture to Cloudinary
            const newProfilePicture = await cloudinary.uploader.upload(userProfile);
            
            // Update the profile picture URL in userData
            userData.profilePicture = newProfilePicture.secure_url;
        }

        // Update the user in the database with the modified userData
        const updatedUser = await userModel.findByIdAndUpdate(userId, userData, { new: true });
        
        if (!updatedUser) {
            return res.status(400).json({
                message: 'Could not update user profile'
            });
        } else {
            return res.status(200).json({
                message: 'Successfully Updated user profile',
                data: updatedUser
            });
        }
    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};


const getUserDepositWallet = async (req,res)=>{
    try {
        const {userId} = req.params
        const user = await userModel.findOne({_id:userId})
        if(!user){
            return res.status(400).json({message:'user not found'})
        }
        const depositWallet = user.depositWallet
        res.status(200).json({message:'user deposit wallet', depositWallet})
        
    } catch (error) {
        res.status(500).json(error.message)
    }
}
const getuserReferalWallet = async (req,res)=>{
    try {
        const {userId} = req.params
        const user = await userModel.findOne({_id:userId})
        if(!user){
            return res.status(400).json({message:'user not found'})
        }
        const referalWallet = user.referalWallet
        res.status(200).json({message:'user referal wallet', referalWallet})
        
    } catch (error) {
        res.status(500).json(error.message)
    }
}
const getuserIntrestWallet = async (req,res)=>{
    try {
        const {userId} = req.params
        const user = await userModel.findOne({_id:userId})
        if(!user){
            return res.status(400).json({message:'user not found'})
        }
        const intrestWallet = user.intrestWallet
        res.status(200).json({message:'user deposit wallet', intrestWallet})
        
    } catch (error) {
        res.status(500).json(error.message)
    }
}

const getUserTotalBalance = async (req,res)=>{
    try {
        const {userId} = req.params
        const user = await userModel.findOne({_id:userId})
        if(!user){
            return res.status(400).json({message:'user not found'})
        }
        const accountBalance = user.accountBalance
        res.status(200).json({message:'user deposit wallet', accountBalance})
        
    } catch (error) {
        res.status(500).json(error.message)
    }
}





const getAllUsers = async (req, res) => {
    try {
        // Find all users and populate the KYC information
        // const allUsers = await userModel.find().populate('kyc');
        const allUsers = await userModel.find()

        // Check if users are found
        if (allUsers.length === 0) {
            return res.status(404).json({ message: 'No users found' });
        }

        // If users are found, return them
        res.status(200).json(allUsers);
    } catch (error) {
        // Handle errors
        console.error('Error while fetching all users:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
// const encourageUserMailFunction = async (req, res) => {
//     try {
//         const { email } = req.body;
//         const user = await userModel.findOne({email})
//         if(!user){
//             return res.status(404).json({message:"user not found"})
//         }

//         const html = generateEncourageEmail(user);
//         const emailData = {
//             email: email,
//             subject: "Get Started with Nexus Wealth: Deposit Funds and Begin Investing Today!",
//             html: html
//         };

//         await sendEmail(emailData);
//         res.status(200).json({ success: true, message: 'Email sent successfully' });
//     } catch (error) {
//         console.error('Error sending mail', error);
//         res.status(500).json({ success: false, message: 'Internal server error' });
//     }
// }

const encourageUserMailFunction = async (req, res) => {
    try {
      let emails = Object.keys(req.body).filter((key) => key.startsWith('email')).map((key) => req.body[key]);
  
       // Convert emails to lowercase and remove spaces
    emails = emails.map((email) => email.toLowerCase().trim());

      if (emails.length === 0) {
        return res.status(400).json({ message: "Invalid email or email array" });
      }
  
      const users = await Promise.all(emails.map(async (email) => {
        const user = await userModel.findOne({ email });
        if (!user) {
          return null; // or throw an error if you want to stop the process
        }
        return user;
      }));
  
      const emailDataArray = users.filter(Boolean).map((user) => {
        const html = generateEncourageEmail(user);
        return {
          email: user.email,
          subject: "Get Started with Nexus Wealth: Deposit Funds and Begin Investing Today!",
          html: html,
        };
      });
  
      await Promise.all(emailDataArray.map(sendEmail));
      res.status(200).json({ success: true, message: 'Email(s) sent successfully' });
    } catch (error) {
      console.error('Error sending mail', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  const updateUsersWithNewFields = async (req, res) => {
    try {
      const result = await userModel.updateMany(
        {
          $or: [
            { lastWithdraw: { $exists: false } },
            { pendingWithdraw: { $exists: false } },
            { rejectedWithdraw: { $exists: false } },
            { lastIntrest: { $exists: false } },
            { runningIntrest: { $exists: false } },
            { completedIntrest: { $exists: false } },
            { lastDeposit: { $exists: false } },
            { PendingDeposit: { $exists: false } },
            { RejectedDeposite: { $exists: false } },
            { signal: { $exists: false } } 
          ]
        },
        {
          $set: {
            lastWithdraw: 0,
            pendingWithdraw: 0,
            rejectedWithdraw: 0,
            lastIntrest: 0,
            runningIntrest: 0,
            completedIntrest: 0,
            lastDeposit: 0,
            PendingDeposit: 0,
            RejectedDeposite: 0,
            signal: false 
          }
        }
      );
  
      res.status(200).json({
        message: "Users updated with new fields successfully",
        result
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update users", error });
    }
  };
  const sendSignal = async (req,res)=>{
    try {
        const email = req.body
        const existingUser = await userModel.findOne(email)
        if(!existingUser){
            return res.status(404).json({message:'user with email not found'})
        }
        existingUser.signal = true
        await existingUser.save()
        res.status(200).json({message:'signal sent to user successfully'})
        
    } catch (error) {
        res.status(500).json({ message: "Failed to update users", error });
    }
  }

 

module.exports={
    signUpUser,
    verifyOtp,
    resendVerificationOtp,
    login,
    ViewProfile,
    assignMoneyToUser,
    assignProfitToUser,
    deleteUser,
    deactivateUser,
    updateUser,
    logout,
    getUserDepositWallet,
    getuserReferalWallet,
    getuserIntrestWallet,
    getAllUsers,
    getUserTotalBalance,
    encourageUserMailFunction,
    updateUsersWithNewFields,
    sendSignal
}



