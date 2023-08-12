import { Document, Model, model, Schema } from "mongoose";

// Interface representing the document structure of the "recipe" model
interface IRecipeDocument extends Document {
  userId: string;
  image?: string;
  image_public_id?: string;
  title: string;
  info?: string;
  ingredients?: {
    id: string;
    value: string;
    isSection?: boolean;
  }[];
  methods?: {
    value: string;
    number: number;
    public_id?: string;
    secure_url?: string;
  }[];
  categories: string[];
  author: string;
  likes: number;
  createdAt: Date;
  updatedAt: Date;
}

// Interface representing the "recipe" model type (for static methods)
interface IRecipeModel extends Model<IRecipeDocument> {
  // Add any custom static methods here if needed
}

// Define the Mongoose Schema
const recipeSchema = new Schema<IRecipeDocument>(
  {
    userId: {
      type: String,
      required: true,
    },
    image: {
      type: String,
    },
    image_public_id: {
      type: String,
    },
    title: {
      type: String,
      required: true,
    },
    info: {
      type: String,
    },
    ingredients: [
      {
        id: String,
        value: String,
        isSection: Boolean,
      },
    ],
    methods: [
      {
        value: String,
        number: Number,
        public_id: String,
        secure_url: String,
      },
    ],
    categories: [String],
    author: {
      name: String,
      username: String,
      image: String,
    },
    likes: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Create and export the "recipe" model
const RecipeModel: IRecipeModel = model<IRecipeDocument, IRecipeModel>(
  "recipe",
  recipeSchema
);

export default RecipeModel;
