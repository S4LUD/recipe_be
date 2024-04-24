import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import UserModel from "../model/user";
import {
  RegisterMiddleware,
  AccountTokenMiddleware,
  accountVerificationMiddleware,
} from "../middleware/user";
import RecipeModel from "../model/recipe";
import CommentModel from "../model/comment";

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
    const { _id, username } = req.res?.locals.data;

    res.header("token", req.res?.locals.token).send({
      status: true,
      _id: _id,
      username: username,
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
      { $project: { _id: 1 } }, // Project only the _id field
    ]);

    // Extract the _id values from the result
    const recipeIds = result.map((recipe) => recipe._id);

    // Step 2: Use the _id values to retrieve the recipes with populated data
    const recommendedRecipes = await RecipeModel.find({
      _id: { $in: recipeIds },
    })
      .populate({
        path: "comments_id",
        model: "comment",
        populate: [
          {
            path: "user_id",
            model: "user",
            select: "image firstName lastName",
          },
        ],
      })
      .populate({
        path: "userId",
        model: "user",
        select: "image",
      });

    // Send the populated recipes as a response
    res.status(200).send(recommendedRecipes);
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
    // Fetch the top 5 liked recipes created within the current week
    const topLikedRecipes = await RecipeModel.find()
      .sort("-likes") // Sort by likes in descending order
      .limit(5)
      .populate({
        path: "comments_id",
        model: "comment",
        populate: [
          {
            path: "user_id",
            model: "user",
            select: "image firstName lastName",
          },
        ],
      })
      .populate({
        path: "userId",
        model: "user",
        select: "image",
      }); // Limit to 5 recipes

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

    const mostRecentRecipe = await RecipeModel.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "comments_id",
        model: "comment",
        populate: [
          {
            path: "user_id",
            model: "user",
            select: "image firstName lastName",
          },
        ],
      })
      .populate({
        path: "userId",
        model: "user",
        select: "image",
      })
      .exec();

    res.status(200).send({ status: true, mostRecentRecipe });
  }
);

router.post(
  "/user/search/recipes",
  // accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const { searchText, categories } = req.body;
    let searchQuery: any = {}; // Define searchQuery with any type for flexibility

    console.log(searchText, categories);

    try {
      if (searchText) {
        const ingredients = searchText
          .split(",")
          .map((ingredient: string) => ingredient.trim());

        // Initialize searchQuery with an $and property as an array
        searchQuery.$and = [];

        // Create an $and query for each ingredient
        ingredients.forEach((ingredient: string | RegExp) => {
          const ingredientRegex = new RegExp(ingredient, "i");
          searchQuery.$and.push({ "ingredients.value": ingredientRegex }); // Search by ingredients
        });
      }

      if (categories?.length > 0) {
        const categoriesArray = Array.isArray(categories)
          ? categories
          : [categories];
        // Add category filter to the search query
        searchQuery = { ...searchQuery, categories: { $in: categoriesArray } };
      }

      // Perform the search using the combined searchQuery
      const searchResults = await RecipeModel.find(searchQuery)
        .populate({
          path: "comments_id",
          model: "comment",
          populate: [
            {
              path: "user_id",
              model: "user",
              select: "image firstName lastName",
            },
          ],
        })
        .populate({
          path: "userId",
          model: "user",
          select: "image",
        });

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
      const result = await UserModel.findById({
        _id: _id,
      })
        .populate({
          path: "recipe_id",
          model: "recipe",
          populate: [
            {
              path: "comments_id",
              model: "comment",
              populate: [
                {
                  path: "user_id",
                  model: "user",
                  select: "image firstName lastName",
                },
              ],
            },
          ],
        })
        .populate({
          path: "recipe_id",
          model: "recipe",
          populate: [
            {
              path: "userId",
              model: "user",
              select: "image",
            },
          ],
        });

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
      const result = await UserModel.findById({
        _id: _id,
      })
        .populate({
          path: "favorites_id",
          model: "recipe",
          populate: [
            {
              path: "comments_id",
              model: "comment",
              populate: [
                {
                  path: "user_id",
                  model: "user",
                  select: "image firstName lastName",
                },
              ],
            },
          ],
        })
        .populate({
          path: "favorites_id",
          model: "recipe",
          populate: [
            {
              path: "userId",
              model: "user",
              select: "image",
            },
          ],
        });

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

router.patch(
  "/user/recipe/comment",
  accountVerificationMiddleware,
  async (req: Request, res: Response) => {
    const { comment, recipe_id, user_id } = req.body;

    const data = new CommentModel({
      comment: comment,
      user_id: user_id,
    });

    const savedData = await data.save();

    if (savedData) {
      const results = await RecipeModel.findByIdAndUpdate(
        { _id: recipe_id },
        {
          $push: {
            comments_id: {
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
        return res.status(200).send(results);
      }
    }

    return res
      .status(400)
      .send({ status: false, message: "failed to comment" });
  }
);

router.post("/user/get/recipe", async (req: Request, res: Response) => {
  const { _id } = req.body;

  const mostRecentRecipe = await RecipeModel.find({ _id: _id })
    .sort({ createdAt: -1 })
    .populate({
      path: "comments_id",
      model: "comment",
      populate: [
        {
          path: "user_id",
          model: "user",
          select: "image firstName lastName",
        },
      ],
    })
    .populate({
      path: "userId",
      model: "user",
      select: "image",
    })
    .exec();

  res.status(200).send({ status: true, mostRecentRecipe });
});

router.get("/users/count", async (req: Request, res: Response) => {
  try {
    // Count all users in the UserModel collection
    const userCount = await UserModel.countDocuments();

    // Return the count of users in the response
    res.status(200).send({ status: true, count: userCount });
  } catch (error) {
    console.error("Error retrieving user count:", error);
    res
      .status(500)
      .send({ status: false, message: "Error retrieving user count" });
  }
});

router.get("/recipes/count", async (req: Request, res: Response) => {
  try {
    // Count all recipes in the RecipeModel collection
    const recipeCount = await RecipeModel.countDocuments();

    // Return the count of recipes in the response
    res.status(200).send({ status: true, count: recipeCount });
  } catch (error) {
    console.error("Error retrieving recipe count:", error);
    res
      .status(500)
      .send({ status: false, message: "Error retrieving recipe count" });
  }
});

router.get("/recipes/top-liked", async (req: Request, res: Response) => {
  try {
    // Find the top 5 most liked recipes, sorted by likes in descending order
    const topLikedRecipes = await RecipeModel.find()
      .sort({ likes: -1 })
      .limit(5)
      .populate({
        path: "comments_id",
        model: "comment",
        populate: [
          {
            path: "user_id",
            model: "user",
            select: "image firstName lastName",
          },
        ],
      })
      .populate({
        path: "userId",
        model: "user",
        select: "image",
      });

    // Return the top liked recipes in the response
    res.status(200).send({ status: true, topLikedRecipes });
  } catch (error) {
    console.error("Error retrieving top liked recipes:", error);
    res
      .status(500)
      .send({ status: false, message: "Error retrieving top liked recipes" });
  }
});

router.get("/users/top-liked", async (req: Request, res: Response) => {
  try {
    // Aggregate to find users with the most liked recipes
    const topLikedUsers = await RecipeModel.aggregate([
      { $group: { _id: "$author.username", totalLikes: { $sum: "$likes" } } },
      { $sort: { totalLikes: -1 } },
      { $limit: 5 }, // Limit to the top 5 users
    ]);

    // Return the top liked users in the response
    res.status(200).send({ status: true, topLikedUsers });
  } catch (error) {
    console.error("Error retrieving top liked users:", error);
    res
      .status(500)
      .send({ status: false, message: "Error retrieving top liked users" });
  }
});

export default router;
