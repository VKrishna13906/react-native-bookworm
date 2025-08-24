import express from "express";
import cloudinary from "../lib/cloudinary.js";
import Book from "../models/Book.js";
import protectRoutes from "../middleware/auth.middleware.js";

const router = express.Router();

// to register or upload the post
router.post("/", protectRoutes, async (req, res) => {
    try {
        const { title, caption, rating, image } = req.body;

        if (!title || !caption || !rating || !image) {
            return res.status(400).json({ message: "Please provide all fields." });
        }

        // upload the image to cloudinary
        const uploadResponse = await cloudinary.uploader.upload(image);
        const imageURL = uploadResponse.secure_url; // provide the image url

        // save the url in Database.

        const newBook = new Book({
            title,
            caption,
            rating,
            image: imageURL,
            user: req.user._id
        });

        await newBook.save();

        res.status(200).json(newBook);
    } catch (error) {
        console.log("Error creating book", error);
        res.status(500).json({ message: error.message });
    }
});

// to get all the post
router.get("/", protectRoutes, async (req, res) => {
    try {
        const page = req.query.page || 1;
        const limit = req.query.limit || 5;
        const skip = (page - 1) * limit;

        const books = await Book.find()
            .sort({ createdAt: -1 }) // -1 i.e. Descending 
            .skip(skip) // skip to makes sure previous fetch data should not be repeated
            .limit(limit) // no of data needs to be fetched
            .populate("user", "username profileImage");

        const totalBooks = Book.countDocuments();

        res.send({
            books,
            currentPage: page,
            totalBooks,
            totalPages: Math.ceil(totalBooks / limit)
        });

    } catch (error) {
        console.log("Error in get all book routes", error);
        res.status(500).json({ message: "Internal server error." });
    }
});

// to get the recommeded post
router.get("/user", protectRoutes, async (req, res) => {
    try {
        const books = await Book.find({ user: req.user._id }).sort({ createdAt: -1});
        res.json(books);
    } catch (error) {
        console.log("Get user book errors", error);
        res.status(500).json({ message: "Internal server error." });
    }
});

// to delete post
router.delete("/:id", protectRoutes, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(404).json({ message: "Book not found" });

        // check if the user is the creator of the book
        if (!book.user.toString() !== req.user._id.toString()) return res.status(401).json({ message: "Unauthorized" });

        // deleting the image from cloudinary
        if (book.image && book.image.includes("cloudinary")) {
            try {
                const publicId = book.image.split("/").pop().split(".")[0];
                await cloudinary.uploader.destroy(publicId);
            } catch (error) {
                console.log("Error deleting image from cloudinary", error);
            }
        }

        await book.deleteOne();

        res.json({ message: "Book deleted successfully." });

    } catch (error) {
        console.log("Error deleting book", error);
        res.status(500).json({ message: "Internal server error" });
    }
})

export default router;