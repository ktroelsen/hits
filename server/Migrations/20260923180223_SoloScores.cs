using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hits.Api.Migrations
{
    /// <inheritdoc />
    public partial class SoloScores : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SoloScores",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    Score = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SoloScores", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SoloScores_Score",
                table: "SoloScores",
                column: "Score");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SoloScores");
        }
    }
}
