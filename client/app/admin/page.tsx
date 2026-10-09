import React from "react";
import type { Metadata } from "next";
import { getConfig } from "@/config/loader";
import { requireTeam } from "@/lib/auth/get-user";

export function generateMetadata(): Metadata {
  const { brand } = getConfig();
  return {
    title: `${brand.name} | Admin Panel`,
  };
}

const AdminHomePage: React.FC = async () => {
  const user = await requireTeam();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Hello, {user.firstName}
      </h1>
      <p className="mt-1 text-muted-foreground">
        Here is what is happening at the restaurant today.
      </p>
    </div>
  );
};

export default AdminHomePage;
