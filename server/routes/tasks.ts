import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { insertTaskSchema } from "@shared/schema";
import { notifyNewTask, notifyTaskAccepted } from "../services/notification";

const router = Router();

// Create a new task
router.post("/api/tasks", async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const validatedData = insertTaskSchema.parse(req.body);
    const task = await storage.createTask({
      ...validatedData,
      clientId: req.user.id,
    });

    // Get all service providers in the task's category
    const providers = await storage.getServiceProvidersByCategory(task.categoryId);
    
    // Send notifications to all eligible providers
    await notifyNewTask(task, providers);

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// Accept a task
router.post("/api/tasks/:taskId/accept", async (req, res, next) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    // Get the task
    const task = await storage.getTask(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check if task is already accepted
    if (task.acceptedById) {
      return res.status(400).json({ message: "Task has already been accepted by another provider" });
    }

    // Get the provider profile
    const provider = await storage.getServiceProviderByUserId(req.user.id);
    if (!provider) {
      return res.status(403).json({ message: "Only service providers can accept tasks" });
    }

    // Check if provider is in the correct category
    if (provider.categoryId !== task.categoryId) {
      return res.status(403).json({ message: "You can only accept tasks in your service category" });
    }

    // Update task status with transaction to ensure atomicity
    const updatedTask = await storage.transaction(async (tx) => {
      // Check again if task is still available (inside transaction)
      const currentTask = await tx.getTask(taskId);
      if (currentTask.acceptedById) {
        throw new Error("Task has already been accepted by another provider");
      }

      // Update task
      return tx.updateTask(taskId, {
        status: "accepted",
        acceptedById: provider.id,
        acceptedAt: new Date(),
      });
    }).catch(error => {
      if (error.message === "Task has already been accepted by another provider") {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    });

    // Get client info for notification
    const client = await storage.getUser(task.clientId);

    // Send notifications
    await notifyTaskAccepted(updatedTask, provider, client);

    res.json(updatedTask);
  } catch (err) {
    next(err);
  }
});

// Get tasks by category
router.get("/api/tasks/category/:categoryId", async (req, res, next) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    if (isNaN(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const tasks = await storage.getTasksByCategory(categoryId);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// Get task by ID
router.get("/api/tasks/:taskId", async (req, res, next) => {
  try {
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const task = await storage.getTask(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
});

export default router; 