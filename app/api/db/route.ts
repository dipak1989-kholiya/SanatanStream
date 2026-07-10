import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/mongodb";

export const dynamic = "force-dynamic";

// GET handler to fetch all videos and categories from MongoDB Atlas
export async function GET() {
  try {
    const db = await getDb();
    
    // Fetch categories and videos from MongoDB collections
    const videosCollection = db.collection("videos");
    const categoriesCollection = db.collection("categories");

    const videos = await videosCollection.find({}).toArray();
    const rawCategories = await categoriesCollection.find({}).toArray();

    // Clean MongoDB's _id fields before returning to client (prevent serialization issues)
    const cleanVideos = videos.map((v) => {
      const { _id, ...rest } = v;
      return rest;
    });

    const cleanCategories = rawCategories.map((c) => c.name);

    return NextResponse.json({
      status: "success",
      videos: cleanVideos,
      categories: cleanCategories,
    });
  } catch (error: any) {
    console.error("MongoDB GET Error:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to fetch data from MongoDB" },
      { status: 500 }
    );
  }
}

// POST handler to manage CRUD actions for categories and videos
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const payload = await req.json();
    const { action, data } = payload;

    if (!action) {
      return NextResponse.json({ status: "error", message: "Action is required" }, { status: 400 });
    }

    const videosCollection = db.collection("videos");
    const categoriesCollection = db.collection("categories");

    // Action: addVideo / updateVideo
    if (action === "addVideo") {
      const videoId = data.id;
      if (!videoId) {
        return NextResponse.json({ status: "error", message: "Video ID is required" }, { status: 400 });
      }

      // Upsert based on video id
      const updatedVideo = {
        id: videoId,
        title: data.title || "",
        url: data.url || "",
        category: data.category || "Meditation",
        description: data.description || "",
        thumbnail: data.thumbnail || "",
        type: data.type || "hls",
        createdAt: data.createdAt || new Date().toISOString()
      };

      await videosCollection.updateOne(
        { id: videoId },
        { $set: updatedVideo },
        { upsert: true }
      );

      return NextResponse.json({ status: "success", action: "addVideo", id: videoId });
    }

    // Action: deleteVideo
    if (action === "deleteVideo") {
      const videoId = data.id;
      if (!videoId) {
        return NextResponse.json({ status: "error", message: "Video ID is required" }, { status: 400 });
      }

      await videosCollection.deleteOne({ id: videoId });
      return NextResponse.json({ status: "success", action: "deleteVideo", id: videoId });
    }

    // Action: addCategory
    if (action === "addCategory") {
      const catName = (data.name || "").trim();
      if (!catName) {
        return NextResponse.json({ status: "error", message: "Category name is required" }, { status: 400 });
      }

      // Check if duplicate
      const exists = await categoriesCollection.findOne({
        name: { $regex: new RegExp(`^${catName}$`, "i") }
      });

      if (exists) {
        return NextResponse.json({ status: "success", message: "Category already exists" });
      }

      await categoriesCollection.insertOne({ name: catName });
      return NextResponse.json({ status: "success", action: "addCategory", name: catName });
    }

    // Action: updateCategory
    if (action === "updateCategory") {
      const oldName = (data.oldName || "").trim();
      const newName = (data.newName || "").trim();

      if (!oldName || !newName) {
        return NextResponse.json({ status: "error", message: "Old and new names are required" }, { status: 400 });
      }

      // 1. Update in categories collection
      await categoriesCollection.updateOne(
        { name: { $regex: new RegExp(`^${oldName}$`, "i") } },
        { $set: { name: newName } }
      );

      // 2. Update matching videos' category in videos collection
      await videosCollection.updateMany(
        { category: { $regex: new RegExp(`^${oldName}$`, "i") } },
        { $set: { category: newName } }
      );

      return NextResponse.json({ status: "success", action: "updateCategory", oldName, newName });
    }

    // Action: deleteCategory
    if (action === "deleteCategory") {
      const catToDelete = (data.name || "").trim();
      const fallbackCat = (data.fallback || "").trim();

      if (!catToDelete || !fallbackCat) {
        return NextResponse.json({ status: "error", message: "Category name and fallback are required" }, { status: 400 });
      }

      // 1. Delete from categories collection
      await categoriesCollection.deleteOne({
        name: { $regex: new RegExp(`^${catToDelete}$`, "i") }
      });

      // 2. Reassign videos of deleted category to fallback category
      await videosCollection.updateMany(
        { category: { $regex: new RegExp(`^${catToDelete}$`, "i") } },
        { $set: { category: fallbackCat } }
      );

      return NextResponse.json({ status: "success", action: "deleteCategory", name: catToDelete, fallback: fallbackCat });
    }

    // Action: seed
    if (action === "seed") {
      // Clear collections
      await videosCollection.deleteMany({});
      await categoriesCollection.deleteMany({});

      // Insert Categories
      const categories = data.categories || [];
      if (categories.length > 0) {
        const catDocs = categories.map((name: string) => ({ name }));
        await categoriesCollection.insertMany(catDocs);
      }

      // Insert Videos
      const videos = data.videos || [];
      if (videos.length > 0) {
        await videosCollection.insertMany(videos);
      }

      return NextResponse.json({ status: "success", action: "seed", message: "Database seeded successfully!" });
    }

    return NextResponse.json({ status: "error", message: `Action not supported: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error("MongoDB POST Error:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to process MongoDB request" },
      { status: 500 }
    );
  }
}
