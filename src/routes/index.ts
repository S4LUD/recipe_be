import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import UserModel, { IUserModel } from "../model/user";
import {
  RegisterMiddleware,
  AccountTokenMiddleware,
  accountVerificationMiddleware,
} from "../middleware/user";
import RecipeModel from "../model/recipe";

const router: Router = Router();
// Set up multer for handling file uploads
const upload = multer({ dest: "uploads/" });

router.post(
  "/user/register",
  RegisterMiddleware,
  async (req: Request, res: Response) => {
    const salt = bcrypt.genSaltSync(10);

    const hashedPassword = bcrypt.hashSync(req.body.password, salt);

    const data = new UserModel({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      username: req.body.username,
      password: hashedPassword,
    });

    try {
      const savedData = await data.save();
      if (savedData) {
        return res
          .status(200)
          .send({ status: true, message: "You've registered successfully" });
      }
    } catch (err) {
      return res.status(400).send(err);
    }
  }
);

router.post(
  "/user/login",
  AccountTokenMiddleware,
  async (req: Request, res: Response) => {
    const { _id } = req.res?.locals.data;
    res.header("token", req.res?.locals.token).send({
      status: true,
      _id: _id,
    });
  }
);

router.post(
  "/user/verify",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const { _id } = (req as any).user;
    res.status(200).send({
      _id,
    });
  }
);

router.patch(
  "/user/update",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const { _id } = (req as any).user;
    const result = await UserModel.findByIdAndUpdate(
      {
        _id: _id,
      },
      {
        $set: {
          username: req.body.username,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          bio: req.body.bio,
        },
      },
      {
        returnDocument: "after",
      }
    );

    if (result)
      return res
        .status(200)
        .send({ status: true, message: "Profile successfully updated" });

    return res
      .status(400)
      .send({ status: false, message: "failed to update profile" });
  }
);

router.get(
  "/user/profile",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const { _id } = (req as any).user;
    const result = await UserModel.findOne({
      _id: _id,
    }).select("-password");
    res.status(200).send(result);
  }
);

const updateUserProfilePicture = async (
  _id: string,
  image: string,
  image_public_id: string
) => {
  try {
    const updateUser = await UserModel.findByIdAndUpdate(
      _id,
      {
        $set: {
          image,
          image_public_id,
        },
      },
      {
        returnDocument: "after",
      }
    );
    return updateUser;
  } catch (error) {
    console.error("Error updating user:", error);
    throw new Error("Failed to update user");
  }
};

router.post(
  "/user/upload/profile",
  accountVerificationMiddleware,
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      const { _id } = (req as any).user;

      if (!req.file) {
        return res.status(400).send({ error: "No file uploaded" });
      }

      const imagePath = req.file.path;

      const cloudinaryResult: any = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload(imagePath, (error: any, result: any) => {
          if (error) {
            console.error("Error uploading image:", error);
            reject(error);
          } else {
            resolve(result);
          }
        });
      });

      if (cloudinaryResult.type === "upload") {
        const updateUser = await updateUserProfilePicture(
          _id,
          cloudinaryResult.secure_url,
          cloudinaryResult.public_id
        );

        if (updateUser) {
          return res.status(200).send({
            status: true,
            message: "Profile picture successfully updated",
          });
        }
      }

      return res.status(400).send({
        status: false,
        message: "Failed to update profile picture",
      });
    } catch (error) {
      return res.status(500).send({
        status: false,
        message: "An error occurred",
      });
    }
  }
);

router.delete(
  "/user/delete/profile/:image_public_id",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const { image_public_id } = req.params;

    try {
      const result = await cloudinary.uploader.destroy(image_public_id);
      res.status(200).send(result);
    } catch (error) {
      res.status(200).send({ status: false, message: "Error deleting image" });
    }
  }
);

router.post(
  "/create/recipe",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { _id } = (req as any).user;
      const {
        _id: recipeId,
        title,
        info,
        ingredients,
        categories,
        methods,
      } = req.body;

      const result = await UserModel.findOne({
        _id: _id,
      });

      if (result) {
        if (recipeId) {
          console.log(
            "Update data",
            recipeId,
            title,
            info,
            ingredients,
            categories,
            methods
          );
          const results = await RecipeModel.findByIdAndUpdate(
            { _id: recipeId },
            {
              $set: {
                title,
                info,
                ingredients,
                categories,
                methods,
              },
            },
            {
              returnDocument: "after",
            }
          );

          if (results) {
            return res.status(200).send({
              status: true,
              message: "You've updated the recipe successfully",
              recipe_id: recipeId,
            });
          }
        } else {
          console.log(
            "New Data",
            recipeId || "recipeId",
            title,
            info,
            ingredients,
            categories,
            methods
          );

          const data = new RecipeModel({
            userId: _id,
            title: title,
            info: info,
            ingredients: ingredients,
            categories: categories,
            methods: methods,
            author: {
              name: `${result?.firstName} ${result?.lastName}`,
              username: result?.username,
              image: result?.image,
            },
          });

          const savedData = await data.save();
          if (savedData) {
            const results = await UserModel.findByIdAndUpdate(
              { _id: _id },
              {
                $push: {
                  recipe_id: {
                    $each: [savedData._id],
                    $position: 0,
                  },
                },
              },
              {
                returnDocument: "after",
              }
            );

            if (results) {
              return res.status(200).send({
                status: true,
                message: "You've created the recipe successfully",
                recipe_id: savedData._id,
              });
            }
          }
        }
      }
    } catch (error) {
      return res.status(200).send({
        status: false,
        message: "An error occurred",
      });
    }
  }
);

const updateRecipeImage = async (
  _id: string,
  image: string,
  image_public_id: string
) => {
  try {
    const updateRecipeImage = await RecipeModel.findByIdAndUpdate(
      _id,
      {
        $set: {
          image,
          image_public_id,
        },
      },
      {
        returnDocument: "after",
      }
    );
    return updateRecipeImage;
  } catch (error) {
    console.error("Error updating user:", error);
    throw new Error("Failed to update user");
  }
};

router.post(
  "/upload/recipe/image/:recipe_id",
  accountVerificationMiddleware,
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      const { recipe_id } = req.params;

      if (!req.file) {
        return res.status(400).send({ error: "No file uploaded" });
      }

      const imagePath = req.file.path;

      const cloudinaryResult: any = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload(imagePath, (error: any, result: any) => {
          if (error) {
            console.error("Error uploading image:", error);
            reject(error);
          } else {
            resolve(result);
          }
        });
      });

      if (cloudinaryResult.type === "upload") {
        const updateImage = await updateRecipeImage(
          recipe_id,
          cloudinaryResult.secure_url,
          cloudinaryResult.public_id
        );

        if (updateImage) {
          return res.status(200).send({
            status: true,
            message: "picture successfully updated",
            updateImage,
          });
        }
      }

      return res.status(400).send({
        status: false,
        message: "Failed to update picture",
      });
    } catch (error) {
      return res.status(500).send({
        status: false,
        message: "An error occurred",
      });
    }
  }
);

router.post(
  "/upload/recipe/methods/image",
  accountVerificationMiddleware,
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).send({ error: "No file uploaded" });
      }

      const imagePath = req.file.path;

      const cloudinaryResult: any = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload(imagePath, (error: any, result: any) => {
          if (error) {
            console.error("Error uploading image:", error);
            reject(error);
          } else {
            resolve(result);
          }
        });
      });

      if (cloudinaryResult.type === "upload") {
        return res.status(200).send({
          secure_url: cloudinaryResult.secure_url,
          public_id: cloudinaryResult.public_id,
        });
      }

      return res.status(400).send({
        status: false,
        message: "Failed to update picture",
      });
    } catch (error) {
      return res.status(500).send({
        status: false,
        message: "An error occurred",
      });
    }
  }
);

router.get(
  "/user/recipes/recommendations",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const result = await RecipeModel.aggregate([
      { $sample: { size: 5 } }, // Retrieve 5 random recipes
    ]);
    res.status(200).send(result);
  }
);

router.get(
  "/user/get/all/recipes",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const result = await RecipeModel.find();
    res.status(200).send(result);
  }
);

router.delete(
  "/user/delete/recipe",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const { _id } = req.body;

    const result = await RecipeModel.findByIdAndDelete({ _id: _id });

    res.status(200).send({ status: 200, message: result });
  }
);

router.patch(
  "/user/add/favorites",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const { _id } = (req as any).user;
    const { _id: recipeId } = req.body;

    const results = await UserModel.findByIdAndUpdate(
      { _id: _id },
      {
        $push: {
          favorites_id: {
            $each: [recipeId],
            $position: 0,
          },
        },
      },
      {
        returnDocument: "after",
      }
    );

    if (results) {
      const likeResult = await RecipeModel.findByIdAndUpdate(
        { _id: recipeId },
        {
          $inc: { likes: 1 },
        }
      );

      if (likeResult)
        return res
          .status(200)
          .send({ status: true, message: "Adding favorites successfully" });
    }

    return res
      .status(400)
      .send({ status: false, message: "Failed to add favorites" });
  }
);

router.patch(
  "/user/remove/favorites",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const { _id } = (req as any).user;
    const { _id: recipeId } = req.body;

    const results = await UserModel.findByIdAndUpdate(
      { _id: _id },
      {
        $pull: { favorites_id: recipeId },
      },
      {
        returnDocument: "after",
      }
    );

    if (results) {
      const likeResult = await RecipeModel.findByIdAndUpdate(
        { _id: recipeId },
        {
          $inc: { likes: -1 },
        }
      );

      if (likeResult)
        return res
          .status(200)
          .send({ status: true, message: "Success removing to favorites" });
    }

    return res
      .status(400)
      .send({ status: false, message: "Failed to remove to favorites" });
  }
);

router.get(
  "/user/get/all/best/recipe",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const currentDate = new Date();

    // Calculate the start and end of the current week
    const startOfCurrentWeek = new Date(currentDate);
    startOfCurrentWeek.setDate(
      currentDate.getDate() - currentDate.getDay() + 1
    ); // Start of the current week (Monday)
    const endOfCurrentWeek = new Date(startOfCurrentWeek);
    endOfCurrentWeek.setDate(startOfCurrentWeek.getDate() + 6); // End of the current week (Sunday)

    // Calculate the start and end of the last week
    const startOfLastWeek = new Date(startOfCurrentWeek);
    startOfLastWeek.setDate(startOfCurrentWeek.getDate() - 7); // Start of the last week (Monday)
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6); // End of the last week (Sunday)

    // Fetch the top 5 liked recipes created within the current week
    const topLikedRecipes = await RecipeModel.find({
      createdAt: { $gte: startOfLastWeek, $lte: endOfCurrentWeek },
    })
      .sort("-likes") // Sort by likes in descending order
      .limit(5); // Limit to 5 recipes

    res.status(200).send({ status: true, topLikedRecipes });
  }
);

router.get(
  "/user/get/all/recent/recipe",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const currentDate = new Date();
    const oneWeekAgo = new Date(currentDate);
    oneWeekAgo.setDate(currentDate.getDate() - 7);

    const mostRecentRecipe = await RecipeModel.find({
      createdAt: { $gte: oneWeekAgo, $lt: currentDate },
    })
      .sort({ createdAt: -1 })
      .exec();

    res.status(200).send({ status: true, mostRecentRecipe });
  }
);

router.post(
  "/user/search/recipes",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const { searchText, categories } = req.body;
    let searchQuery = {};

    try {
      if (searchText) {
        // Use regular expression to perform a case-insensitive search on the title field
        const searchRegex = new RegExp(searchText, "i");
        searchQuery = { ...searchQuery, title: searchRegex };
      }

      if (categories?.length > 0) {
        const categoriesArray = Array.isArray(categories)
          ? categories
          : [categories];
        // Add category filter to the search query
        searchQuery = { ...searchQuery, categories: { $in: categoriesArray } };
      }

      // Perform the search using the combined searchQuery
      const searchResults = await RecipeModel.find(searchQuery);

      res.status(200).send(searchResults);
    } catch (error) {
      console.error("Error searching recipes:", error);
      res.status(500).send({ message: "Error searching recipes" });
    }
  }
);

router.get(
  "/user/get/all/my/recipe",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const { _id } = (req as any).user;

    try {
      // Perform the search using the combined searchQuery
      const result: IUserModel = await UserModel.findById({
        _id: _id,
      })
        .populate({
          path: "recipe_id",
        })
        .select([
          "-_id",
          "-password",
          "-firstName",
          "-lastName",
          "-username",
          "-favorites_id",
          "-createdAt",
          "-updatedAt",
          "-image",
          "-image_public_id",
          "-bio",
        ]);

      res.status(200).send({ status: true, recipe_id: result?.recipe_id });
    } catch (error) {
      console.error("Error getting recipes:", error);
      res.status(500).send({ status: false, message: "Error getting recipes" });
    }
  }
);

router.get(
  "/user/get/all/my/favorites",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const { _id } = (req as any).user;

    try {
      // Perform the search using the combined searchQuery
      const result: IUserModel = await UserModel.findById({
        _id: _id,
      })
        .populate({
          path: "favorites_id",
        })
        .select([
          "-_id",
          "-password",
          "-firstName",
          "-lastName",
          "-username",
          "-recipe_id",
          "-createdAt",
          "-updatedAt",
          "-image",
          "-image_public_id",
          "-bio",
        ]);

      res
        .status(200)
        .send({ status: true, favorites_id: result?.favorites_id });
    } catch (error) {
      console.error("Error getting favorite recipes:", error);
      res
        .status(500)
        .send({ status: false, message: "Error getting favorite recipes" });
    }
  }
);

export default router;
