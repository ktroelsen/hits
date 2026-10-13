using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hits.Api.Migrations
{
    /// <inheritdoc />
    public partial class RankedTags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RankedTags",
                columns: table => new
                {
                    Tag = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    ValuePrefix = table.Column<string>(type: "TEXT", nullable: false),
                    ValueSuffix = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RankedTags", x => x.Tag);
                });

            migrationBuilder.CreateTable(
                name: "SongTagValues",
                columns: table => new
                {
                    Tag = table.Column<string>(type: "TEXT", nullable: false),
                    SongId = table.Column<string>(type: "TEXT", nullable: false),
                    Value = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SongTagValues", x => new { x.Tag, x.SongId });
                    table.ForeignKey(
                        name: "FK_SongTagValues_RankedTags_Tag",
                        column: x => x.Tag,
                        principalTable: "RankedTags",
                        principalColumn: "Tag",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SongTagValues_Songs_SongId",
                        column: x => x.SongId,
                        principalTable: "Songs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SongTagValues_SongId",
                table: "SongTagValues",
                column: "SongId");

            migrationBuilder.CreateIndex(
                name: "IX_SongTagValues_Tag_Value",
                table: "SongTagValues",
                columns: new[] { "Tag", "Value" });

            // "top 100" (DR's Danmarks bedste sange) gets numbers; they come from the
            // top 100 candidates in /admin.
            migrationBuilder.Sql(
                "INSERT INTO RankedTags (Tag, Description, ValuePrefix, ValueSuffix, CreatedAt) " +
                "VALUES ('top 100', 'DR: Danmarks bedste sange gennem tiderne', '#', '', '2026-10-13 00:00:00')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SongTagValues");

            migrationBuilder.DropTable(
                name: "RankedTags");
        }
    }
}
