const Topic = require("../models/topicModel");  
const Tag = require("../models/tagModel");  
const Comment = require("../models/commentModel");  
const Space = require("../models/spaceModel");  

module.exports = {  
  deleteTopic: async (req, res) => {  
    const { id } = req.params;  
    console.log(id);
    
    try {  
      const topic = await Topic.findById(id);  
      if (!topic) {  
        return res.status(404).json({  
          message: "Topic not found with this ID.",  
        });  
      }  
      console.log(req.user, topic);
      
      if (req.user._id != topic.owner) {  
        return res.status(403).json({  
          message: "You are not allowed to delete this topic",  
        });  
      }  
      await Comment.deleteMany({ parentTopic: id });  
      await Topic.findByIdAndDelete(id);  
      return res.json({ topicId: id, message: "Topic deleted successfully!" });  
    } catch (err) {  
      console.log(err.message);  
      return res.status(500).json({ error: 'Internal server error' });  
    }  
  },  

  toggleUpvoteTopic: async (req, res) => {  
    const { id } = req.params;  
    try {  
      const topic = await Topic.findById(id);  
      if (!topic) {  
        return res.status(404).json({  
          message: "Topic not found!",  
        });  
      }  
      if (topic.upvotes.includes(req.user.username)) {  
        topic.upvotes.pull(req.user.username);  
      } else {  
        topic.upvotes.push(req.user.username);  
        topic.downvotes.pull(req.user.username); // Ensure they can't downvote as well  
      }  
      await topic.save();  
      return res.status(200).json({  
        topicId: id,  
        username: req.user.username,  
        message: "Topic upvote toggled successfully.",  
      });  
    } catch (err) {  
      return res.status(403).json({  
        Error: err.message,  
      });  
    }  
  },  

  toggleDownvoteTopic: async (req, res) => {  
    const { id } = req.params;  
    try {  
      const topic = await Topic.findById(id);  
      if (!topic) {  
        return res.status(404).json({  
          message: "Topic not found!",  
        });  
      }  
      if (topic.downvotes.includes(req.user.username)) {  
        topic.downvotes.pull(req.user.username);  
      } else {  
        topic.downvotes.push(req.user.username);  
        topic.upvotes.pull(req.user.username); // Ensure they can't upvote as well  
      }  
      await topic.save();  
      return res.status(200).json({  
        topicId: id,  
        username: req.user.username,  
        message: "Topic downvote toggled successfully.",  
      });  
    } catch (err) {  
      return res.status(403).json({  
        Error: err.message,  
      });  
    }  
  },  

  getTopContributors: async (req, res) => {  
    try {  
      let topContributors = await Topic.aggregate([  
        {  
          $group: {  
            _id: "$owner", // Group by owner (ObjectId)  
            count: { $sum: 1 },  
          }  
        },  
        { $sort: { count: -1 } },  
        {  
          $lookup: {  
            from: "users", // Ensure this matches your collection name  
            localField: "_id", // Field from Topic  
            foreignField: "_id", // Field from User (MongoDB uses ObjectId for _id)  
            as: "author",  
            pipeline: [{ $project: { password: 0, __v: 0 } }]  
          }  
        },  
        { $unwind: "$author" },  
        { $limit: 3 },  
      ]);  

      return res.status(200).json(topContributors);  
    } catch (err) {  
      console.error(err.message);  
      return res.status(500).json({ error: 'Internal server error' });  
    }  
  },  

  getSpaces: async (req, res) => {  
    try {  
      const spaces = await Space.find({});  
      return res.status(200).json(spaces);  
    } catch (err) {  
      console.log(err.message);  
      return res.status(500).json({ error: 'Internal server error' });  
    }  
  },  

  getAllTopics: async (req, res) => {  
    try {  
      const { search, sort, page = 1, limit = 10, searchUser } = req.query;  
      let sortOptions = {};  
      let searchQuery = {};  

      if (searchUser) {  
        searchQuery.owner = searchUser; // Searching by owner if provided  
      }  

      if (search && search.length > 0) {  
        searchQuery.title = new RegExp(search, "i");  
      }  

      // Sorting options logic  
      if (sort === "latest") {  
        sortOptions = { createdAt: -1 };  
      } else if (sort === "popular") {  
        sortOptions = { viewsCount: -1 };  
      } else if (sort === "most_replied") {  
        sortOptions = { totalComments: -1 };  
      } else if (sort === "most_upvoted") {  
        sortOptions = { upvotes: -1 };  
      }  

      // Pagination logic  
      const skip = (page - 1) * limit;  
      const totalTopics = await Topic.countDocuments(searchQuery);  
      let topics = await Topic.find(searchQuery)  
        .sort(sortOptions)  
        .skip(skip)  
        .limit(parseInt(limit))  
        .populate("tags")  
        .populate({ path: "owner", select: { password: 0, __v: 0 } }) // Populate owner instead of author  
        .lean()  
        .exec();  

      return res.json({  
        topics,  
        totalTopics,  
        currentPage: parseInt(page),  
        totalPages: Math.ceil(totalTopics / limit),  
      });  
    } catch (err) {  
      console.log(err.message);  
      return res.status(500).json({ message: "An error occurred." });  
    }  
  },  

  getTopic: async (req, res) => {  
    const { slug } = req.params;  
    try {  
      const topic = await Topic.findOneAndUpdate(  
        { _id: slug },  
        { $inc: { viewsCount: 1 } },  
        { returnOriginal: false }  
      )  
        .populate("tags")  
        .populate({ path: "owner", select: { password: 0, __v: 0 } }) // Populate owner  
        .lean()  
        .exec();  
      if (!topic) {  
        return res.status(404).json({ message: "Topic not found!" });  
      }  
      return res.status(200).json(topic);  
    } catch (err) {  
      console.log(err.message);  
      return res.status(500).json({ error: 'Internal server error' });  
    }  
  },  
  
  addTopic: async (req, res) => {  
    try {  
      const { title, content, selectedSpace, selectedTags } = req.body;  

      // Handle tag creation or selection  
      let createdTags = await Promise.all(selectedTags.map(async (tagInfo) => {  
        let tagFound = await Tag.findOne({ name: tagInfo.value });  
        if (tagFound) {  
          return tagFound._id;  
        } else {  
          let tag = await Tag.create({ name: tagInfo.value, createdBy: req.user._id });  
          return tag._id;  
        }  
      }));  

      const slug = title.toString().normalize("NFKD").toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w\-]+/g, "").replace(/\_/g, "-").replace(/\-\-+/g, "-").replace(/\-$/g, "");  

      // Create topic with owner as well  
      let topic = await Topic.create({  
        title: title.trim(),  
        content: content.trim(),  
        slug: slug.trim(),  
        tags: createdTags,  
        owner: req.user._id // Correctly set owner  
      });  
      
      topic = await topic.populate({  
        path: "owner",  
        select: { password: 0, __v: 0 },  
      });  

      return res.status(201).json({ topic, message: "Topic created successfully!" });  
    } catch (err) {  
      console.error(err.message);  
      return res.status(500).json({ error: 'Internal server error' });  
    }  
  }  
};