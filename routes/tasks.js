module.exports = function (router) {
    const User = require('../models/user.js');
    const Task = require('../models/task.js');

    const tasksRoute = router.route('/tasks');
    const tasksIdRoute = router.route('/tasks/:id');

    tasksRoute.post(async function (req, res) {
        const newTask = new Task(req.body);
        const err = newTask.validateSync();

        if (err) {
            return (res.status(400).json({message: 'Bad request' + err.message, data: null}));
        }

        try {
            let savedTask;
            await Task.db.transaction(async (session) => {
                savedTask = await newTask.save({session});  
            });

            if (savedTask.assignedUser) {
                await User.findByIdAndUpdate(savedTask.assignedUser, {$push: {pendingTasks: savedTask._id}});
            }

            res.status(201).json({message: 'Task created', data: savedTask});

        } catch (e) {

            if (e.code === 11000) {
                return res.status(400).json({message: 'Duplicate task' + e.message, data: null});
            }
            return res.status(500).json({message: 'Server error' + e.message, data: null});
        }
    });

    tasksRoute.get(async function (req, res) {
        try {
            const query = Task.find();
            query.collection(Task.collection);

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
            let limit = 100;
            if (req.query.limit !== undefined) {
                limit = parseInt(req.query.limit, 10);
                if (isNaN(limit) || limit <= 0) {
                    limit = 100;
                }
            }
            query.limit(limit);
            const result = await query.exec();

            res.status(200).json({message: 'Tasks', data: result});
        } catch (err) {
            res.status(500).json({message: 'Server error' + err.message, data: null});
        }
    });

    tasksIdRoute.get(async function (req, res) {
        const taskId = req.params["id"];
        const query = Task.findById(taskId);
        query.collection(Task.collection);

        try {
            if (req.query.select) {
                query.select(JSON.parse(req.query.select));
            }

            const result = await query.exec();

            if (result) {
                res.status(200).json({message: "Found task", data: result});
            } else {
                return res.status(404).json({message: 'Task not found', data: null});
            }
        } catch (err) {
             res.status(500).json({message: 'Server error:' + err.message, data: null});
        }
    });

    tasksIdRoute.put(async function (req, res) {
        try {
            const taskId = req.params.id;
            const updateData = req.body;
            const oldTask = await Task.findById(taskId);

            if (!oldTask) {
                return res.status(404).json({message: 'Task not found', data: null});
            }

            const updatedTask = await Task.findByIdAndUpdate(taskId, updateData, {new: true, runValidators: true});

            let oldUserId;
            if (oldTask.assignedUser) {
                oldUserId = oldTask.assignedUser.toString();
            } else {
                oldUserId = null;
            }

            let newUserId;
            if (updatedTask.assignedUser) {
                newUserId = updatedTask.assignedUser.toString();
            } else {
                newUserId = null;
            }

            if (oldUserId !== newUserId) {

                if (oldUserId) {
                    await User.findByIdAndUpdate(oldUserId, {
                        $pull: { pendingTasks: oldTask._id } 
                    });
                }

                if (newUserId) {
                    await User.findByIdAndUpdate(newUserId, {$push: { pendingTasks: updatedTask._id }});
                }
            }

            res.status(200).json({message: 'Task updated successfully', data: updatedTask});

        } catch (err) {
            if (err.name === 'ValidationError' || err.code === 11000) {
                 return res.status(400).json({
                    message: 'Validation Error: ' + err.message,
                    data: null
                });
            }
            res.status(500).json({message: 'Server error: ' + err.message, data: null});
        }
    });

    tasksIdRoute.delete(async function (req, res) {
        try {
            const taskId = req.params.id;
            const deletedTask = await Task.findByIdAndDelete(taskId);


            if (deletedTask) {
                await User.findByIdAndUpdate(deletedTask.assignedUser, {$pull: {pendingTasks: deletedTask._id}});
                res.status(204).send();
            } else {
                return res.status(404).json({message: 'Task not found', data: null})
            }

        } catch (err) {
            res.status(500).json({message: 'Server error' + err.message, data: null});
        }
    });

    return router;
}