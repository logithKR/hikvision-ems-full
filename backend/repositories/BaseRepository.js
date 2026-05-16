/**
 * BaseRepository.js
 * 
 * Base repository class with common database operations.
 * All specific repositories (User, Attendance, etc.) will extend this.
 * 
 * SOLID Principles:
 * - Single Responsibility: Handles only database access
 * - Open/Closed: Open for extension (other repos extend it), closed for modification
 * - Dependency Inversion: Depends on abstraction (db instance injected)
 */

class BaseRepository {
  /**
   * @param {FirebaseFirestore.Firestore} db - Firestore instance
   * @param {string} collectionName - Name of the Firestore collection
   */
  constructor(db, collectionName) {
    if (!db) {
      throw new Error('Database instance is required');
    }
    if (!collectionName) {
      throw new Error('Collection name is required');
    }
    
    this.db = db;
    this.collectionName = collectionName;
  }

  /**
   * Get reference to the base collection
   * For hierarchical collections: override this in child classes
   */
  getCollection() {
    return this.db.collection(this.collectionName);
  }

  /**
   * Create a new document with auto-generated ID
   * @param {Object} data - Data to save
   * @returns {Promise<Object>} Created document with ID
   */
  async create(data) {
    try {
      const docRef = this.getCollection().doc();
      const timestamp = new Date().toISOString();
      
      const documentData = {
        id: docRef.id,
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await docRef.set(documentData);
      
      // console.log(`✅ [${this.collectionName}] Created document: ${docRef.id}`);
      return documentData;
    } catch (error) {
      console.error(`❌ [${this.collectionName}] Create error:`, error);
      throw new Error(`Failed to create document: ${error.message}`);
    }
  }

  /**
   * Create a document with a specific ID
   * @param {string} id - Document ID
   * @param {Object} data - Data to save
   * @returns {Promise<Object>} Created document
   */
  async createWithId(id, data) {
    try {
      const docRef = this.getCollection().doc(id);
      const timestamp = new Date().toISOString();
      
      const documentData = {
        id,
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await docRef.set(documentData);
      
      // console.log(`✅ [${this.collectionName}] Created document with ID: ${id}`);
      return documentData;
    } catch (error) {
      console.error(`❌ [${this.collectionName}] Create with ID error:`, error);
      throw new Error(`Failed to create document with ID: ${error.message}`);
    }
  }

  /**
   * Find a document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object|null>} Document data or null if not found
   */
  async findById(id) {
    try {
      const doc = await this.getCollection().doc(id).get();
      
      if (!doc.exists) {
        // console.log(`⚠️ [${this.collectionName}] Document not found: ${id}`);
        return null;
      }

      const data = { id: doc.id, ...doc.data() };
      // console.log(`✅ [${this.collectionName}] Found document: ${id}`);
      return data;
    } catch (error) {
      console.error(`❌ [${this.collectionName}] FindById error:`, error);
      throw new Error(`Failed to find document: ${error.message}`);
    }
  }

  /**
   * Find documents by a specific field value
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @param {Object} options - Query options (limit, orderBy)
   * @returns {Promise<Array>} Array of documents
   */
  async findBy(field, value, options = {}) {
    try {
      let query = this.getCollection().where(field, '==', value);

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      // Apply ordering
      if (options.orderBy) {
        const { field: orderField, direction = 'asc' } = options.orderBy;
        query = query.orderBy(orderField, direction);
      }

      const snapshot = await query.get();
      
      const documents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // console.log(`✅ [${this.collectionName}] Found ${documents.length} documents where ${field} = ${value}`);
      return documents;
    } catch (error) {
      console.error(`❌ [${this.collectionName}] FindBy error:`, error);
      throw new Error(`Failed to find documents: ${error.message}`);
    }
  }

  /**
   * Get all documents
   * @param {Object} options - Query options (limit, orderBy)
   * @returns {Promise<Array>} Array of all documents
   */
  async findAll(options = {}) {
    try {
      let query = this.getCollection();

      // Apply limit
      if (options.limit) {
        query = query.limit(options.limit);
      }

      // Apply ordering
      if (options.orderBy) {
        const { field, direction = 'asc' } = options.orderBy;
        query = query.orderBy(field, direction);
      }

      const snapshot = await query.get();
      
      const documents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // console.log(`✅ [${this.collectionName}] Found ${documents.length} documents`);
      return documents;
    } catch (error) {
      console.error(`❌ [${this.collectionName}] FindAll error:`, error);
      throw new Error(`Failed to find all documents: ${error.message}`);
    }
  }

  /**
   * Update a document by ID
   * @param {string} id - Document ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} Updated document
   */
  async update(id, data) {
    try {
      const docRef = this.getCollection().doc(id);
      
      // Check if document exists
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new Error(`Document not found: ${id}`);
      }

      const updateData = {
        ...data,
        updatedAt: new Date().toISOString()
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      await docRef.update(updateData);
      
      // Fetch updated document
      const updatedDoc = await docRef.get();
      const result = { id: updatedDoc.id, ...updatedDoc.data() };

      console.log(`✅ [${this.collectionName}] Updated document: ${id}`);
      return result;
    } catch (error) {
      console.error(`❌ [${this.collectionName}] Update error:`, error);
      throw new Error(`Failed to update document: ${error.message}`);
    }
  }

  /**
   * Delete a document by ID (hard delete)
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id) {
    try {
      const docRef = this.getCollection().doc(id);
      
      // Check if document exists
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new Error(`Document not found: ${id}`);
      }

      await docRef.delete();
      
      console.log(`✅ [${this.collectionName}] Deleted document: ${id}`);
      return true;
    } catch (error) {
      console.error(`❌ [${this.collectionName}] Delete error:`, error);
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Soft delete (mark as inactive)
   * @param {string} id - Document ID
   * @returns {Promise<Object>} Updated document
   */
  async softDelete(id) {
    try {
      return await this.update(id, { 
        isActive: false,
        deletedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(`❌ [${this.collectionName}] Soft delete error:`, error);
      throw new Error(`Failed to soft delete document: ${error.message}`);
    }
  }

  /**
   * Check if a document exists
   * @param {string} id - Document ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(id) {
    try {
      const doc = await this.getCollection().doc(id).get();
      return doc.exists;
    } catch (error) {
      console.error(`❌ [${this.collectionName}] Exists check error:`, error);
      throw new Error(`Failed to check document existence: ${error.message}`);
    }
  }

  /**
   * Count documents in collection
   * @param {Object} filter - Optional filter { field, value }
   * @returns {Promise<number>} Document count
   */
  async count(filter = null) {
    try {
      let query = this.getCollection();

      if (filter) {
        query = query.where(filter.field, '==', filter.value);
      }

      const snapshot = await query.get();
      const count = snapshot.size;

      console.log(`✅ [${this.collectionName}] Count: ${count}`);
      return count;
    } catch (error) {
      console.error(`❌ [${this.collectionName}] Count error:`, error);
      throw new Error(`Failed to count documents: ${error.message}`);
    }
  }

  /**
   * Execute a transaction
   * @param {Function} callback - Transaction callback function
   * @returns {Promise<any>} Transaction result
   */
  async transaction(callback) {
    try {
      return await this.db.runTransaction(async (transaction) => {
        return await callback(transaction);
      });
    } catch (error) {
      console.error(`❌ [${this.collectionName}] Transaction error:`, error);
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  /**
   * Batch write operations
   * @param {Array} operations - Array of { type, id, data }
   * @returns {Promise<boolean>} True if successful
   */
  async batch(operations) {
    try {
      const batch = this.db.batch();

      for (const op of operations) {
        const docRef = this.getCollection().doc(op.id);

        switch (op.type) {
          case 'create':
          case 'set':
            batch.set(docRef, {
              id: op.id,
              ...op.data,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            break;

          case 'update':
            batch.update(docRef, {
              ...op.data,
              updatedAt: new Date().toISOString()
            });
            break;

          case 'delete':
            batch.delete(docRef);
            break;

          default:
            throw new Error(`Unknown operation type: ${op.type}`);
        }
      }

      await batch.commit();
      console.log(`✅ [${this.collectionName}] Batch operation completed: ${operations.length} operations`);
      return true;
    } catch (error) {
      console.error(`❌ [${this.collectionName}] Batch error:`, error);
      throw new Error(`Batch operation failed: ${error.message}`);
    }
  }
}

module.exports = BaseRepository;
