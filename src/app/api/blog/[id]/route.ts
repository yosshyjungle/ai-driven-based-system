import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { main } from "../route";

const prisma = new PrismaClient()

export const GET = async (req: Request, res: NextResponse) => {
  try {
    const id: number = parseInt(req.url.split("/blog/")[1]);
    await main();

    const post = await prisma.post.findFirst({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            imageUrl: true
          }
        }
      }
    });

    if (!post) {
      return NextResponse.json({ message: "Not Found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Success", post }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ message: "Error", err }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
};

export const PUT = async (req: Request, res: NextResponse) => {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const id: number = parseInt(req.url.split("/blog/")[1]);
    const { title, description } = await req.json();

    await main();

    // 投稿の所有者確認
    const existingPost = await prisma.post.findFirst({
      where: { id },
      select: { authorId: true }
    });

    if (!existingPost) {
      return NextResponse.json({ message: "Not Found" }, { status: 404 });
    }

    if (existingPost.authorId !== userId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const post = await prisma.post.update({
      data: { title, description },
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            imageUrl: true
          }
        }
      }
    });

    return NextResponse.json({ message: "Success", post }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ message: "Error", err }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
};

export const DELETE = async (req: Request, res: NextResponse) => {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const id: number = parseInt(req.url.split("/blog/")[1]);

    await main();

    // 投稿の所有者確認
    const existingPost = await prisma.post.findFirst({
      where: { id },
      select: { authorId: true }
    });

    if (!existingPost) {
      return NextResponse.json({ message: "Not Found" }, { status: 404 });
    }

    if (existingPost.authorId !== userId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const post = await prisma.post.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Success", post }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ message: "Error", err }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
};