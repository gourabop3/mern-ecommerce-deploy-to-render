const createOrder = async (req, res) => {
  try {
    const {
      userId,
      cartItems,
      addressInfo,
      orderStatus,
      paymentMethod,
      paymentStatus,
      totalAmount,
      orderDate,
      orderUpdateDate,
      paymentId,
      payerId,
      cartId,
    } = req.body;

    // ✅ Handle UPI or COD (manual flow)
    if (paymentMethod === "UPI" || paymentMethod === "COD") {
      const newOrder = new Order({
        userId,
        cartId,
        cartItems,
        addressInfo,
        orderStatus: orderStatus || "pending",
        paymentMethod,
        paymentStatus: paymentStatus || "pending",
        totalAmount,
        orderDate,
        orderUpdateDate,
        paymentId: null,
        payerId: null,
      });

      await newOrder.save();

      // Update stock
      for (let item of cartItems) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.totalStock -= item.quantity;
          await product.save();
        }
      }

      // Delete cart
      await Cart.findByIdAndDelete(cartId);

      return res.status(201).json({
        success: true,
        message: `${paymentMethod} order created`,
        orderId: newOrder._id,
      });
    }

    // ✅ Handle PayPal as before
    const create_payment_json = {
      intent: "sale",
      payer: {
        payment_method: "paypal",
      },
      redirect_urls: {
        return_url: `${process.env.CLIENT_BASE_URL}/shop/paypal-return`,
        cancel_url: `${process.env.CLIENT_BASE_URL}/shop/paypal-cancel`,
      },
      transactions: [
        {
          item_list: {
            items: cartItems.map((item) => ({
              name: item.title,
              sku: item.productId,
              price: item.price.toFixed(2),
              currency: "USD",
              quantity: item.quantity,
            })),
          },
          amount: {
            currency: "USD",
            total: totalAmount.toFixed(2),
          },
          description: "description",
        },
      ],
    };

    paypal.payment.create(create_payment_json, async (error, paymentInfo) => {
      if (error) {
        console.log(error);
        return res.status(500).json({
          success: false,
          message: "Error while creating PayPal payment",
        });
      }

      const newlyCreatedOrder = new Order({
        userId,
        cartId,
        cartItems,
        addressInfo,
        orderStatus,
        paymentMethod,
        paymentStatus,
        totalAmount,
        orderDate,
        orderUpdateDate,
        paymentId,
        payerId,
      });

      await newlyCreatedOrder.save();

      const approvalURL = paymentInfo.links.find(
        (link) => link.rel === "approval_url"
      ).href;

      res.status(201).json({
        success: true,
        approvalURL,
        orderId: newlyCreatedOrder._id,
      });
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};