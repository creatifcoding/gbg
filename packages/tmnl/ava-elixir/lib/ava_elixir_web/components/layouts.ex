defmodule AvaElixirWeb.Layouts do
  use AvaElixirWeb, :html

  def root(assigns) do
    ~H"""
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>AVA Phoenix Surface</title>
      </head>
      <body>
        <%= @inner_content %>
        <script src="/ops_live_hooks.js"></script>
      </body>
    </html>
    """
  end
end
