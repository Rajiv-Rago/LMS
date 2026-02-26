import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db!;

  // Hash password
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash("password123", salt);

  // Create users
  const usersCol = db.collection("users");
  const existingAdmin = await usersCol.findOne({ email: "admin@demo.com" });
  if (existingAdmin) {
    console.log("Seed data already exists. Skipping.");
    await mongoose.disconnect();
    return;
  }

  await usersCol.insertOne({
    email: "admin@demo.com",
    name: "Demo Admin",
    password: hashedPassword,
    role: "admin",
    failedLoginAttempts: 0,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const teacher = await usersCol.insertOne({
    email: "teacher@demo.com",
    name: "Demo Teacher",
    password: hashedPassword,
    role: "teacher",
    failedLoginAttempts: 0,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const student = await usersCol.insertOne({
    email: "student@demo.com",
    name: "Demo Student",
    password: hashedPassword,
    role: "student",
    failedLoginAttempts: 0,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log("Created 3 users (admin, teacher, student)");

  // Create a course
  const coursesCol = db.collection("courses");
  const course = await coursesCol.insertOne({
    title: "Introduction to Web Development",
    description:
      "A comprehensive course covering HTML, CSS, JavaScript, and modern web frameworks.",
    instructor: teacher.insertedId,
    enrolledStudents: [student.insertedId],
    modules: [],
    isPublished: true,
    courseType: "standard",
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Create a module
  const modulesCol = db.collection("modules");
  const mod = await modulesCol.insertOne({
    title: "Getting Started with HTML",
    description: "Learn the fundamentals of HTML markup.",
    course: course.insertedId,
    lessons: [],
    order: 0,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Create a lesson
  const lessonsCol = db.collection("lessons");
  const lesson = await lessonsCol.insertOne({
    title: "HTML Basics: Tags and Structure",
    module: mod.insertedId,
    contentType: "text",
    content:
      "# HTML Basics\n\nHTML (HyperText Markup Language) is the standard language for creating web pages.\n\n## Tags\n\nHTML uses tags to define elements. Tags are enclosed in angle brackets like `<tag>`.",
    order: 0,
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Update module with lesson
  await modulesCol.updateOne(
    { _id: mod.insertedId },
    { $set: { lessons: [lesson.insertedId] } }
  );

  // Update course with module
  await coursesCol.updateOne(
    { _id: course.insertedId },
    { $set: { modules: [mod.insertedId] } }
  );

  // Create a quiz assignment
  const assignmentsCol = db.collection("assignments");
  await assignmentsCol.insertOne({
    title: "HTML Basics Quiz",
    description: "Test your knowledge of basic HTML tags and structure.",
    course: course.insertedId,
    module: mod.insertedId,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    points: 10,
    submissionType: "text",
    isPublished: true,
    assignmentType: "quiz",
    questions: [
      {
        id: "q1",
        question: "What does HTML stand for?",
        options: [
          "Hyper Text Markup Language",
          "High Tech Modern Language",
          "Hyper Transfer Markup Language",
          "Home Tool Markup Language",
        ],
        correctAnswer: 0,
        explanation: "HTML stands for HyperText Markup Language.",
        points: 5,
      },
      {
        id: "q2",
        question: "Which tag is used for the largest heading?",
        options: ["<heading>", "<h6>", "<h1>", "<head>"],
        correctAnswer: 2,
        explanation: "<h1> defines the largest heading in HTML.",
        points: 5,
      },
    ],
    quizSettings: {
      shuffleQuestions: false,
      showCorrectAnswers: true,
    },
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log("Created 1 course with 1 module, 1 lesson, and 1 quiz assignment");
  console.log("\nSeed complete! Login credentials:");
  console.log("  Admin:   admin@demo.com / password123");
  console.log("  Teacher: teacher@demo.com / password123");
  console.log("  Student: student@demo.com / password123");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
