import { Request, Response, NextFunction } from "express";
import User from "../models/User.js";
import { configureOpenAI, ModelName } from "../config/openai.js";
import OpenAI from "openai";
import { saveModel, loadModel, deleteModel } from "../utils/modelStorage.js";
import { fineTuneModel, saveTrainingDataToFile, uploadTrainingData } from "../utils/fineTuneModel.js";

export const generateChatCompletion = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const { message } = req.body;

		const user = await User.findById(res.locals.jwtData.id);
		if (!user) {
			return res.status(401).json("User not registered / token malfunctioned");
		}

		const conversation = user.conversations[user.conversations.length - 1] || { chats: [] };
		const chats = conversation.chats.map(({ role, content }) => ({ role, content }));
		chats.push({ content: message, role: "user" });

		const config = configureOpenAI();
		const openai = new OpenAI(config);
		const chatResponse = await openai.chat.completions.create({
			model: ModelName,
			messages: chats as OpenAI.Chat.ChatCompletionMessageParam[],
		});

		conversation.chats.push(chatResponse.choices[0]?.message || { role: "assistant", content: "" });
		await user.save();

		return res.status(200).json({ chats: conversation.chats });
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: error.message });
	}
};

export const getAllConversations = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const user = await User.findById(res.locals.jwtData.id);
		if (!user) {
			return res.status(401).json({
				message: "ERROR",
				cause: "User doesn't exist or token malfunctioned",
			});
		}

		return res.status(200).json({
			message: "OK",
			conversations: user.conversations || [],
		});
	} catch (err) {
		console.log(err);
		return res.status(500).json({ message: "ERROR", cause: err.message });
	}
};

export const deleteConversation = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const user = await User.findById(res.locals.jwtData.id);
		const { conversationId } = req.params;

		if (!user) {
			return res.status(401).json({
				message: "ERROR",
				cause: "User doesn't exist or token malfunctioned",
			});
		}

		user.conversations = user.conversations.filter(
			(convo: any) => convo.id !== conversationId
		);
		await user.save();

		return res.status(200).json({
			message: "OK",
			conversations: user.conversations || [],
		});
	} catch (err) {
		console.log(err);
		return res.status(500).json({ message: "ERROR", cause: err.message });
	}
};

export const startNewConversation = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const user = await User.findById(res.locals.jwtData.id);
		if (!user) {
			return res.status(401).json({
				message: "ERROR",
				cause: "User doesn't exist or token malfunctioned",
			});
		}

		user.conversations.push({ chats: [] });
		await user.save();

		return res.status(200).json({
			message: "New conversation started",
			conversation: user.conversations[user.conversations.length - 1] || { chats: [] },
		});
	} catch (err) {
		console.log(err);
		return res.status(500).json({ message: "ERROR", cause: err.message });
	}
};

export const createCustomModel = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const userId = res.locals.jwtData.id;
		const { trainingData, modelName } = req.body;
		const trainingFilePath = await saveTrainingDataToFile(trainingData);
		const trainingFileId = await uploadTrainingData(trainingFilePath);
		const fineTunedModel = await fineTuneModel(trainingFileId);

		saveModel(userId, fineTunedModel, modelName);

		res.status(201).json({
			message: "Model fine-tuned and saved",
			model: fineTunedModel,
			trainingFileId,
		});
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

export const getCustomModels = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const user = await User.findById(res.locals.jwtData.id);
		if (!user) {
			return res.status(401).json({
				message: "ERROR",
				cause: "User doesn't exist or token malfunctioned",
			});
		}

		return res.status(200).json({
			message: "OK",
			CustomModels: user.CustomModels || [],
		});
	} catch (err) {
		console.log(err);
		return res.status(500).json({ message: "ERROR", cause: err.message });
	}
};
