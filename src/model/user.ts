import { Document, Model, model, Schema } from "mongoose";

// Interface representing the document structure of the "user" model
interface IUserDocument extends Document {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  image_public_id?: string;
  recipe_id?: string[];
  favorites_id?: string[];
  image?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Interface representing the "user" model type (for static methods)
export interface IUserModel extends Model<IUserDocument> {
  recipe_id: any;
  favorites_id: any;
  // Add any custom static methods here if needed
}

// Define the Mongoose Schema
const userSchema = new Schema<IUserDocument>(
  {
    firstName: {
      type: String,
      required: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: true,
      maxlength: 50,
    },
    username: {
      type: String,
      required: true,
      maxlength: 15,
      minlength: 3,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    image: {
      type: String,
    },
    image_public_id: {
      type: String,
    },
    recipe_id: [
      {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "recipe",
      },
    ],
    bio: {
      type: String,
      maxlength: 200,
    },
    favorites_id: [
      {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "recipe",
      },
    ],
  },
  { timestamps: true }
);

// Create and export the "user" model
const UserModel: IUserModel = model<IUserDocument, IUserModel>(
  "user",
  userSchema
);

export default UserModel;
