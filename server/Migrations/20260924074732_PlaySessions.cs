using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hits.Api.Migrations
{
    /// <inheritdoc />
    public partial class PlaySessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HostSessionId",
                table: "Games",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PlaySessions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    OrderJson = table.Column<string>(type: "TEXT", nullable: false),
                    PlayedJson = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlaySessions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlaySessions_LastSeenAt",
                table: "PlaySessions",
                column: "LastSeenAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlaySessions");

            migrationBuilder.DropColumn(
                name: "HostSessionId",
                table: "Games");
        }
    }
}
