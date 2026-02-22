import mongoose, { Document, Model } from "mongoose";

export interface IMigration extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  executedAt: Date;
}

type MigrationModel = Model<IMigration>;

const migrationSchema = new mongoose.Schema<IMigration, MigrationModel>({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  executedAt: {
    type: Date,
    default: Date.now,
  },
});

const Migration =
  (mongoose.models.Migration as MigrationModel) ||
  mongoose.model<IMigration, MigrationModel>("Migration", migrationSchema);

export default Migration;
