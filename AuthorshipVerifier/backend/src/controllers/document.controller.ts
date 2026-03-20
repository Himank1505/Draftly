import { Request, Response } from "express";
import { prisma } from "../config/db";

export const getDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const documents = await prisma.document.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" }
    });

    res.status(200).json({ documents });
  } catch {
    res.status(500).json({ message: "Failed to fetch documents" });
  }
};

export const createDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { title, content } = req.body as { title?: string; content?: string };

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!title || !content) {
      res.status(400).json({ message: "Title and content are required" });
      return;
    }

    const document = await prisma.document.create({
      data: {
        title,
        content,
        ownerId: userId
      }
    });

    res.status(201).json({ document });
  } catch {
    res.status(500).json({ message: "Failed to create document" });
  }
};