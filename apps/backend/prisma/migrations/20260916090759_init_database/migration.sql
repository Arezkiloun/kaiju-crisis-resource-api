-- CreateEnum
CREATE TYPE "Role" AS ENUM ('QC', 'LC', 'CD');

-- CreateEnum
CREATE TYPE "DistrictCode" AS ENUM ('A', 'E', 'W', 'X', 'Z');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RouteType" AS ENUM ('DIRECT', 'TRANSIT', 'MARITIME', 'REQUISITION');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDistrict" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "districtId" INTEGER NOT NULL,

    CONSTRAINT "UserDistrict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" SERIAL NOT NULL,
    "code" "DistrictCode" NOT NULL,
    "name" TEXT NOT NULL,
    "seaAccess" BOOLEAN NOT NULL DEFAULT false,
    "severityLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistrictAdjacency" (
    "id" SERIAL NOT NULL,
    "districtAId" INTEGER NOT NULL,
    "districtBId" INTEGER NOT NULL,

    CONSTRAINT "DistrictAdjacency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ResourceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceStock" (
    "id" SERIAL NOT NULL,
    "districtId" INTEGER NOT NULL,
    "resourceTypeId" INTEGER NOT NULL,
    "initialQuantity" INTEGER NOT NULL,
    "currentQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" SERIAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "userId" INTEGER NOT NULL,
    "resourceStockId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" SERIAL NOT NULL,
    "sourceDistrictId" INTEGER NOT NULL,
    "destinationDistrictId" INTEGER NOT NULL,
    "resourceTypeId" INTEGER NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "routeType" "RouteType" NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferApproval" (
    "id" SERIAL NOT NULL,
    "transferId" INTEGER NOT NULL,
    "districtId" INTEGER NOT NULL,
    "approverId" INTEGER,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "TransferApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisasterState" (
    "key" TEXT NOT NULL DEFAULT 'GLOBAL',
    "level" INTEGER NOT NULL DEFAULT 1,
    "retentionPercent" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisasterState_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "districtId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserDistrict_userId_districtId_key" ON "UserDistrict"("userId", "districtId");

-- CreateIndex
CREATE UNIQUE INDEX "District_code_key" ON "District"("code");

-- CreateIndex
CREATE UNIQUE INDEX "District_name_key" ON "District"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DistrictAdjacency_districtAId_districtBId_key" ON "DistrictAdjacency"("districtAId", "districtBId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceType_name_key" ON "ResourceType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceStock_districtId_resourceTypeId_key" ON "ResourceStock"("districtId", "resourceTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferApproval_transferId_districtId_key" ON "TransferApproval"("transferId", "districtId");

-- AddForeignKey
ALTER TABLE "UserDistrict" ADD CONSTRAINT "UserDistrict_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDistrict" ADD CONSTRAINT "UserDistrict_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistrictAdjacency" ADD CONSTRAINT "DistrictAdjacency_districtAId_fkey" FOREIGN KEY ("districtAId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistrictAdjacency" ADD CONSTRAINT "DistrictAdjacency_districtBId_fkey" FOREIGN KEY ("districtBId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceStock" ADD CONSTRAINT "ResourceStock_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceStock" ADD CONSTRAINT "ResourceStock_resourceTypeId_fkey" FOREIGN KEY ("resourceTypeId") REFERENCES "ResourceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_resourceStockId_fkey" FOREIGN KEY ("resourceStockId") REFERENCES "ResourceStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_sourceDistrictId_fkey" FOREIGN KEY ("sourceDistrictId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_destinationDistrictId_fkey" FOREIGN KEY ("destinationDistrictId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_resourceTypeId_fkey" FOREIGN KEY ("resourceTypeId") REFERENCES "ResourceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferApproval" ADD CONSTRAINT "TransferApproval_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferApproval" ADD CONSTRAINT "TransferApproval_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferApproval" ADD CONSTRAINT "TransferApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
