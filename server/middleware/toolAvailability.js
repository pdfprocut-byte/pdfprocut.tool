import ManagedTool from '../models/ManagedTool.js';
import { ApiError } from '../utils/ApiError.js';

export const requireEnabledTool = async (req, res, next) => {
  try {
    const endpoint = req.path.replace(/^\//, '').split('/')[0];
    const tool = await ManagedTool.findOne({ endpoint }).select('enabled name').lean();
    if (tool && !tool.enabled) return next(new ApiError(503, `${tool.name} is temporarily unavailable.`));
    next();
  } catch (error) { next(error); }
};
