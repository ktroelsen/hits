using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hits.Api.Migrations
{
    /// <inheritdoc />
    public partial class TagSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TagSettings",
                columns: table => new
                {
                    Tag = table.Column<string>(type: "TEXT", nullable: false),
                    Active = table.Column<bool>(type: "INTEGER", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TagSettings", x => x.Tag);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TagSettings");
        }
    }
}
