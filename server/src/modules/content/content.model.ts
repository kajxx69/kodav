import { Schema, model, type Types } from 'mongoose';
import { CLIENT_PROFILES, type ClientProfile } from '@kodav/shared';
import { baseSchemaOptions } from '../../lib/mongoose.js';

export interface FaqDoc {
  question: string;
  answer: string;
  category: string;
  order: number;
  isPublished: boolean;
}

const faqSchema = new Schema<FaqDoc>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    category: { type: String, default: 'general', index: true },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  baseSchemaOptions,
);
export const Faq = model<FaqDoc>('Faq', faqSchema);

export const TESTIMONIAL_STATUSES = ['en_attente', 'publie', 'rejete'] as const;

export interface TestimonialDoc {
  authorName: string;
  role: string;
  company: string;
  profile?: ClientProfile;
  content: string;
  rating: number;
  status: (typeof TESTIMONIAL_STATUSES)[number];
  consentAt?: Date;
  order: number;
  /** Avis déposé par un client depuis son espace (sinon saisi par l'équipe). */
  client?: Types.ObjectId | null;
}

const testimonialSchema = new Schema<TestimonialDoc>(
  {
    authorName: { type: String, required: true, trim: true },
    role: { type: String, default: '' },
    company: { type: String, default: '' },
    profile: { type: String, enum: CLIENT_PROFILES },
    content: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    // Publié uniquement après validation par l'équipe.
    status: { type: String, enum: TESTIMONIAL_STATUSES, default: 'en_attente', index: true },
    consentAt: Date,
    order: { type: Number, default: 0 },
    client: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions,
);
export const Testimonial = model<TestimonialDoc>('Testimonial', testimonialSchema);

export interface ProjectDoc {
  slug: string;
  title: string;
  category: string;
  client: string;
  summary: string;
  content: string;
  images: { url: string; publicId?: string; alt: string }[];
  tags: string[];
  status: 'brouillon' | 'publie';
  publishedAt?: Date;
  seo?: { title: string; description: string };
}

const projectSchema = new Schema<ProjectDoc>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true },
    category: { type: String, default: '' },
    client: { type: String, default: '' },
    summary: { type: String, default: '' },
    content: { type: String, default: '' },
    images: [{ _id: false, url: String, publicId: String, alt: String }],
    tags: [String],
    status: { type: String, enum: ['brouillon', 'publie'], default: 'brouillon', index: true },
    publishedAt: Date,
    seo: { title: String, description: String },
  },
  baseSchemaOptions,
);
export const Project = model<ProjectDoc>('Project', projectSchema);
