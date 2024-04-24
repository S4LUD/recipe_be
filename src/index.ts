import express, { Application, Request, Response } from "express";
import mongoose from "mongoose";
import cors from "cors";
import routes from "./routes";
import env from "./util/env";
import { v2 as cloudinary } from "cloudinary";

const app: Application = express();

// Middleware to parse incoming JSON data
app.use(
  cors({
    origin: "*",
  })
);

app.use(express.json({ limit: "50mb" }));

cloudinary.config({
  cloud_name: env.CLOUD_NAME,
  api_key: env.CLOUD_API_KEY,
  api_secret: env.CLOUD_API_SECRET,
});

mongoose
  .set("strictQuery", true)
  .connect(env.DB_CONNECT)
  .then(() => {
    console.log("Connected to mongoDB");
    // Start the server
    app.listen(env.PORT, () => {
      console.log(`Server is running`);
    });
  })
  .catch((err) => console.log(err));

// routes
app.use("/api", routes);
