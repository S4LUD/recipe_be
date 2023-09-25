import { Document, Model, model, Schema } from "mongoose";

// Interface representing the document structure of the "user" model
interface ICommentDocument extends Document {
  comment: string;
  user_id: string;
}

// Interface representing the "user" model type (for static methods)
export interface ICommentModel extends Model<ICommentDocument> {
  recipe_id: any;
  // Add any custom static methods here if needed
}

// Define the Mongoose Schema
const userSchema = new Schema<ICommentDocument>(
  {
    comment: {
      type: String,
      required: true,
    },
    user_id: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Create and export the "user" model
const CommentModel: ICommentModel = model<ICommentDocument, ICommentModel>(
  "comment",
  userSchema
);

export default CommentModel;
