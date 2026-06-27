const express = require('express');

const multer = require('multer');

const Document = require('../models/Document');

const Project = require('../models/Project');

const auth = require('../middleware/auth');

const { isProjectOwner, isProjectBroker, getProjectForUser } = require('../utils/projectAccess');

const { checkStorageLimit } = require('../middleware/planLimits');

const { uploadBuffer } = require('../services/pdfProcessor');

const { createNotification } = require('../services/notificationService');



const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });



router.use(auth);



const ALLOWED_MIMES = [

  'application/pdf',

  'application/msword',

  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  'image/jpeg',

  'image/png',

  'image/jpg',

];



const handleMulter = (req, res, next) => {

  upload.single('file')(req, res, (err) => {

    if (err) {

      console.error('Document multer error:', err.message);

      return res.status(400).json({ success: false, error: err.message || 'Invalid file upload' });

    }

    next();

  });

};



router.post('/projects/:id/documents', handleMulter, checkStorageLimit, async (req, res) => {

  try {

    console.log('Document upload for project:', req.params.id, 'user:', req.user?._id);

    const project = await Project.findById(req.params.id);

    if (!project || !isProjectOwner(project, req.user._id)) {

      return res.status(404).json({ success: false, error: 'Project not found' });

    }

    if (!req.file) {

      return res.status(400).json({ success: false, error: 'File required. Use form field name "file".' });

    }

    if (!ALLOWED_MIMES.includes(req.file.mimetype)) {

      return res.status(400).json({ success: false, error: 'Allowed types: PDF, DOC, DOCX, JPG, PNG' });

    }



    const result = await uploadBuffer(

      req.file.buffer,

      req.file.originalname,

      req.file.mimetype,

      'documents'

    );



    const doc = await Document.create({

      projectId: project._id,

      uploadedBy: req.user._id,

      name: req.body.name || req.file.originalname,

      type: req.body.type || 'other',

      fileUrl: result.secure_url,

      fileSize: req.file.size,

      accessLevel: 'brokers_visible',

      expiryDate: req.body.expiryDate || null,

    });



    const brokers = project.brokers.filter((b) => ['active', 'invited'].includes(b.status));

    await Promise.all(

      brokers.map((b) =>

        createNotification({

          userId: b.userId,

          type: 'document_uploaded',

          title: 'New document shared',

          message: `"${doc.name}" uploaded to ${project.name}`,

          data: { projectId: project._id, documentId: doc._id },

        }).catch((e) => console.warn('Broker notification failed:', e.message))

      )

    );



    res.status(201).json({ success: true, document: doc, data: { document: doc }, message: 'Document uploaded' });

  } catch (err) {

    console.error('Document upload error:', err.message, err.stack);

    res.status(500).json({ success: false, error: err.message || 'Upload failed' });

  }

});



router.get('/projects/:id/documents', async (req, res) => {

  try {

    const project = await getProjectForUser(req.params.id, req.user._id, req.user.role);

    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });



    const isOwner = isProjectOwner(project, req.user._id);

    const query = { projectId: project._id };

    if (!isOwner) query.accessLevel = 'brokers_visible';



    const documents = await Document.find(query).populate('uploadedBy', 'name').sort({ createdAt: -1 });

    res.json({ success: true, documents });

  } catch (err) {

    console.error('Document list error:', err.message);

    res.status(500).json({ success: false, error: err.message });

  }

});



router.get('/:id/view', async (req, res) => {

  try {

    const doc = await Document.findById(req.params.id);

    if (!doc) return res.status(404).json({ message: 'Document not found' });



    const project = await Project.findById(doc.projectId);

    const isOwner = isProjectOwner(project, req.user._id);

    const isBroker = isProjectBroker(project, req.user._id);



    if (!isOwner && (!isBroker || doc.accessLevel !== 'brokers_visible')) {

      return res.status(403).json({ message: 'Access denied' });

    }



    doc.viewLog.push({ userId: req.user._id, viewedAt: new Date() });

    await doc.save();



    res.json({ url: doc.fileUrl, document: doc });

  } catch (err) {

    console.error('Document view error:', err.message);

    res.status(500).json({ success: false, error: err.message });

  }

});



router.delete('/:id', async (req, res) => {

  try {

    const doc = await Document.findById(req.params.id);

    if (!doc) return res.status(404).json({ message: 'Document not found' });



    const project = await Project.findById(doc.projectId);

    if (!isProjectOwner(project, req.user._id)) {

      return res.status(403).json({ message: 'Only owners can delete documents' });

    }



    await doc.deleteOne();

    res.json({ success: true, message: 'Document deleted' });

  } catch (err) {

    console.error('Document delete error:', err.message);

    res.status(500).json({ success: false, error: err.message });

  }

});



module.exports = router;

