using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hits.Api.Migrations
{
    /// <inheritdoc />
    public partial class SongActive : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Active",
                table: "Songs",
                type: "INTEGER",
                nullable: false,
                defaultValue: true); // existing songs stay in play
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Active",
                table: "Songs");
        }
    }
}
