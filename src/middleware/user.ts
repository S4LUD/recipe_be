import { Request, Response, NextFunction } from "express";
import UserModel from "../model/user";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import env from "../util/env";

const RegisterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await UserModel.findOne({ username: req.body.username });
    if (result)
      return res.status(200).send({
        status: false,
        message: "Username already exists",
      });
    next();
  } catch (error) {
    if (error) return res.status(400).send(error);
    next();
  }
};

const AccountTokenMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await UserModel.findOne({
      username: req.body.username,
    });

    if (!result)
      return res.status(200).send({
        status: false,
        message: "Invalid credentials",
      });

    const validate = bcrypt.compareSync(req.body.password, result.password);
    if (!validate)
      return res
        .status(200)
        .send({ status: false, message: "Invalid credentials." });

    const token = jwt.sign(
      {
        _id: result._id,
      },
      env.TOKEN_SECRET,
      {
        expiresIn: "12hr",
      }
    );

    res.locals.token = token;
    res.locals.data = result;
    next();
  } catch (error) {
    if (error) return res.status(400).send(error);
  }
};

const accountVerificationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let Authorization = req.headers.authorization_r;

  if (!Authorization || Array.isArray(Authorization)) {
    return res.status(401).send({ status: false, message: "Unauthorized" });
  }

  const processToken = (Authorization as string).split(" ")[1];
  try {
    const verified = jwt.verify(processToken, env.TOKEN_SECRET);

    (req as any).user = verified;

    next();
  } catch (error) {
    res.status(400).send({ status: false, message: "invalid token" });
  }
};

export {
  RegisterMiddleware,
  AccountTokenMiddleware,
  accountVerificationMiddleware,
};
