module.exports = function (router) {
    const User = require('../models/user.js');
    const Task = require('../models/task.js');

    const usersRoute = router.route('/users');
    const usersIdRoute = router.route('/users/:id');

    usersRoute.post(async function (req, res) {
        const newUser = new User(req.body);
        const err = newUser.validateSync();

        if (err) {
            return (res.status(400).json({message: 'Bad request' + err.message, data: null}));
        }

        try {
            let savedUser;
            await User.db.transaction(async (session) => {
                savedUser = await newUser.save({session});  
            });

            res.status(201).json({message: 'User created', data: savedUser});

        } catch (e) {

            if (e.code === 11000) {
                return res.status(400).json({message: 'Duplicate email' + e.message, data: null});
            }
            return res.status(500).json({message: 'Server error' + e.message, data: null});
        }
    });

    usersRoute.get(async function (req, res) {
        try {
            const query = User.find();
            query.collection(User.collection);

            if (req.query.where) {
                query.where(JSON.parse(req.query.where));
            }
            if (req.query.select) {
                query.select(JSON.parse(req.query.select));
            }
            if (req.query.count) {
                const count = await query.countDocuments();
                return res.status(200).json({message: 'Document count', data: count})
            }
            if (req.query.sort) {
                query.sort(JSON.parse(req.query.sort));
            }
            if (req.query.skip) {
                query.skip(parseInt(req.query.skip));
            }
            if (req.query.limit) {
                query.limit(parseInt(req.query.limit));
            }
            const result = await query.exec();

            res.status(200).json({message: 'Users', data: result});
        } catch (err) {
            res.status(500).json({message: 'Server error' + err.message, data: null});
        }
    });

    usersIdRoute.get(async function (req, res) {
        const userId = req.params["id"];
        const query = User.findById(userId);
        query.collection(User.collection);

        try {
            if (req.query.select) {
                query.select(JSON.parse(req.query.select));
            }

            const result = await query.exec();

            if (result) {
                res.status(200).json({message: "Found user", data: result});
            } else {
                return res.status(404).json({message: 'User not found', data: null});
            }
        } catch (err) {
             res.status(500).json({message: 'Server error:' + err.message, data: null});
        }
    });


    usersIdRoute.put(async function (req, res) {
        try {
            const userId = req.params.id;
            const updateData = req.body;
            const updatedUser = await User.findByIdAndUpdate(userId, updateData, {new: true, runValidators: true});
            if (updatedUser) {
                res.status(200).json({message: 'User updated', data: updatedUser});
            } else {
                return res.status(404).json({message: 'User not found', data: null});
            }

        } catch (err) {
            res.status(500).json({message: 'Server error' + err.message, data: null});
        }
    });

    usersIdRoute.delete(async function (req, res) {
        try {
            const userId = req.params.id;
            const deletedUser = await User.findByIdAndDelete(userId);

            if (deletedUser) {
                await Task.updateMany({assignedUser: deletedUser._id}, {assignedUser: "", assignedUserName: "unassigned"});
                res.status(204).send();
            } else {
                return res.status(404).json({message: 'User not found', data: null})
            }
        } catch (err) {
            res.status(500).json({message: 'Server error' + err.message, data: null});
        }
    });

    return router;
}