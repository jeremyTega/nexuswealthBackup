const mongoose = require('mongoose')
const userSchema = new mongoose.Schema({
    userName:{type:String, require:true},
    email:{type:String, require:true, unique:true},
    mobile:{type:String, require:true}, 
    country:{type:String, require:true}, 
    password:{type:String, require:true},
    firstName:{type:String, },
    lastName:{type:String, },
    address:{type:String,  },
    zipCode:{type:String, },
    city:{type:String, },
    accountBalance: { type: Number, default: 0 },
    depositWallet: { type: Number, default: 0 },
    intrestWallet: { type: Number, default: 0 },
    referalWallet: { type: Number, default: 0 },
    referralCount: { type: Number, default: 0 },
    isAdmin:{type:Boolean, default:false},
    isVerified:{type: Boolean, default:false},
    deactivate:{type: Boolean, default:false},
    isLoggedIn:{type: Boolean, default:false},
    twoFactor:{type: Boolean, default:false},
    signal:{type: Boolean, default:false},
    profilePicture: {
      public_id: { type: String},
       url:{ type: String, },
         },
    otpId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'otpverification'
      },
      // kyc: {
      //   type: mongoose.Schema.Types.ObjectId,
      //   ref: 'kyc'
      // },
      kyc: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'kyc'
        },
        verified: {
            type: Boolean,
            default: false
        }
    },
    referralLink: { type: String },
    tickets: [
      {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ticket'
      }
  ]
},
{timestamps:true})

const userModel = mongoose.model("user", userSchema)
module.exports = userModel
